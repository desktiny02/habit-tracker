'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { Reward, Redemption } from '@/types';
import { RewardCard } from '@/components/rewards/RewardCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase/config';
import { doc, onSnapshot, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { redeemReward, useCoupon, deleteReward } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function RewardsPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [showUsedCoupons, setShowUsedCoupons] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');

  useEffect(() => {
    if (!user) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setTotalPoints(snap.data().totalPoints || 0);
    });

    const loadRewards = async () => {
      try {
        const qRewards = query(collection(db, 'rewards'), where('userId', '==', user.uid));
        const qRedemptions = query(collection(db, 'redemptions'), where('userId', '==', user.uid));
        const [rewSnaps, redSnaps] = await Promise.all([getDocs(qRewards), getDocs(qRedemptions)]);
        
        setRewards(rewSnaps.docs.map((d) => ({ ...d.data(), id: d.id } as Reward)));
        const loadedRedemptions = redSnaps.docs.map((d) => ({ ...d.data(), id: d.id } as Redemption));
        setRedemptions(loadedRedemptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err: unknown) {
        console.error(err);
        toast.error('Failed to load rewards');
      } finally {
        setLoading(false);
      }
    };
    loadRewards();

    return () => unsubscribeUser();
  }, [user]);

  const [confirmingRewardId, setConfirmingRewardId] = useState<string | null>(null);
  const confirmingReward = rewards.find(r => r.id === confirmingRewardId);

  const handleRedeem = async (reward: Reward) => {
    // First click shows confirmation; second click executes
    if (confirmingRewardId !== reward.id) {
      setConfirmingRewardId(reward.id);
      return;
    }
    if (!user) return;
    setRedeemingId(reward.id);
    setConfirmingRewardId(null);
    try {
      await redeemReward(user.uid, reward);
      toast.success(`Redeemed "${reward.name}"!`);
      const qRedemptions = query(collection(db, 'redemptions'), where('userId', '==', user.uid));
      const redSnaps = await getDocs(qRedemptions);
      const loadedRedemptions = redSnaps.docs.map((d) => ({ ...d.data(), id: d.id } as Redemption));
      setRedemptions(loadedRedemptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to redeem');
    } finally {
      setRedeemingId(null);
    }
  };

  const [confirmingCouponId, setConfirmingCouponId] = useState<string | null>(null);

  const handleUseCoupon = async (redemptionId: string) => {
    if (confirmingCouponId !== redemptionId) {
      setConfirmingCouponId(redemptionId);
      return;
    }
    setUsingId(redemptionId);
    setConfirmingCouponId(null);
    try {
      await useCoupon(redemptionId);
      setRedemptions(prev => prev.map(r => r.id === redemptionId ? { ...r, status: 'used' } : r));
      toast.success('Coupon used successfully!');
    } catch {
      toast.error('Failed to use coupon');
    } finally {
      setUsingId(null);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = newRewardName.trim();
    if (!trimmedName) return void toast.error('Reward name cannot be empty');
    const cost = parseInt(newRewardCost, 10);
    if (isNaN(cost) || cost <= 0) return void toast.error('Cost must be a positive number');
    if (cost > 100000) return void toast.error('Cost cannot exceed 100,000');

    try {
      const docRef = await addDoc(collection(db, 'rewards'), {
        userId: user.uid,
        name: trimmedName,
        cost,
      });
      const newReward: Reward = { id: docRef.id, userId: user.uid, name: trimmedName, cost };
      setRewards((prev) => [...prev, newReward]);
      setShowForm(false);
      setNewRewardName('');
      setNewRewardCost('');
      toast.success('Reward created!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reward';
      toast.error(msg);
    }
  };

  const handleDeleteReward = async (reward: Reward) => {
    try {
      await deleteReward(reward.id);
      setRewards((prev) => prev.filter((r) => r.id !== reward.id));
      toast.success('Reward deleted');
    } catch {
      toast.error('Failed to delete reward');
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Rewards
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Available:{' '}
            <span className="font-bold" style={{ color: 'var(--accent)' }}>
              {totalPoints} pts
            </span>
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'secondary' : 'primary'}
        >
          {showForm ? 'Cancel' : 'New Reward'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreateReward}
          className="rounded-2xl p-5 mb-8 flex flex-col md:flex-row gap-4 items-end"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex-1 w-full">
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Reward Name
            </label>
            <Input
              type="text"
              required
              placeholder="e.g. Treat myself to ice cream"
              value={newRewardName}
              onChange={(e) => setNewRewardName(e.target.value)}
            />
          </div>
          <div className="w-full md:w-32">
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cost (pts)
            </label>
            <Input
              type="number"
              required
              min="1"
              placeholder="100"
              value={newRewardCost}
              onChange={(e) => setNewRewardCost(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full md:w-auto h-11 px-8">
            Save
          </Button>
        </form>
      )}

      {/* Redemption Confirmation */}
      {confirmingReward && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '2px solid var(--accent)',
            boxShadow: '0 0 20px rgba(99,102,241,0.15)',
          }}
        >
          <h3 className="font-bold text-base mb-3" style={{ color: 'var(--text-primary)' }}>
            Redeem &quot;{confirmingReward.name}&quot;?
          </h3>
          <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span>Current points</span>
            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{totalPoints}</span>
          </div>
          <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span>Cost</span>
            <span className="font-bold" style={{ color: 'var(--danger)' }}>−{confirmingReward.cost}</span>
          </div>
          <div
            className="flex justify-between text-sm pt-2 mt-2 font-bold"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <span>Remaining</span>
            <span style={{ color: totalPoints - confirmingReward.cost >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalPoints - confirmingReward.cost} pts
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmingRewardId(null)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleRedeem(confirmingReward)}
              disabled={redeemingId === confirmingReward.id || totalPoints < confirmingReward.cost}
            >
              {redeemingId === confirmingReward.id ? 'Redeeming…' : 'Confirm Redeem'}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div
            className="w-8 h-8 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : rewards.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '2px dashed var(--border-strong)',
          }}
        >
          <div className="text-4xl mb-3">🎁</div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            No rewards yet
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Create rewards to treat yourself for your hard work!
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-6" variant="outline">
            Create First Reward
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...rewards]
            .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
            .map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={totalPoints}
              onRedeem={handleRedeem}
              onDelete={handleDeleteReward}
              isLoading={redeemingId === reward.id}
            />
          ))}
        </div>
      )}

      {/* Coupons List */}
      {!loading && redemptions.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              My Coupons
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowUsedCoupons(!showUsedCoupons)}
            >
              {showUsedCoupons ? 'Hide Used Coupons' : 'Show Used Coupons'}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {redemptions
              .filter(red => showUsedCoupons || red.status !== 'used')
              .map((red) => (
              <div
                key={red.id}
                className="rounded-2xl p-5 flex flex-col justify-between"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  opacity: red.status === 'used' ? 0.6 : 1,
                  filter: red.status === 'used' ? 'grayscale(80%)' : 'none',
                }}
              >
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {red.rewardName || 'Reward'}
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Redeemed on {format(new Date(red.date), 'MMM d, yyyy')}
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  {red.status === 'used' ? (
                    <div className="text-sm font-medium text-center py-2" style={{ color: 'var(--text-muted)' }}>
                      Used
                    </div>
                  ) : confirmingCouponId === red.id ? (
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        variant="secondary"
                        onClick={() => setConfirmingCouponId(null)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        className="flex-1" 
                        variant="danger"
                        onClick={() => handleUseCoupon(red.id)}
                        disabled={usingId === red.id}
                      >
                        {usingId === red.id ? 'Using...' : 'Confirm'}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full" 
                      onClick={() => handleUseCoupon(red.id)}
                      disabled={usingId === red.id}
                      variant="primary"
                    >
                      Use Coupon
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
