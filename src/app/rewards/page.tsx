'use client';

import { useAuth } from '@/lib/firebase/auth';
import AppLayout from '@/components/layout/AppLayout';
import { useEffect, useState } from 'react';
import { Reward } from '@/types';
import { RewardCard } from '@/components/rewards/RewardCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/firebase/config';
import { doc, onSnapshot, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { redeemReward } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';

export default function RewardsPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
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
        const q = query(collection(db, 'rewards'), where('userId', '==', user.uid));
        const snaps = await getDocs(q);
        setRewards(snaps.docs.map((d) => ({ ...d.data(), id: d.id } as Reward)));
      } catch {
        toast.error('Failed to load rewards');
      } finally {
        setLoading(false);
      }
    };
    loadRewards();

    return () => unsubscribeUser();
  }, [user]);

  const handleRedeem = async (reward: Reward) => {
    if (!user) return;
    setRedeemingId(reward.id);
    try {
      await redeemReward(user.uid, reward);
      toast.success(`Redeemed "${reward.name}"!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to redeem');
    } finally {
      setRedeemingId(null);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cost = parseInt(newRewardCost, 10);
    if (isNaN(cost) || cost <= 0) return void toast.error('Cost must be a positive number');

    try {
      const docRef = await addDoc(collection(db, 'rewards'), {
        userId: user.uid,
        name: newRewardName,
        cost,
      });
      const newReward: Reward = { id: docRef.id, userId: user.uid, name: newRewardName, cost };
      setRewards((prev) => [...prev, newReward]);
      setShowForm(false);
      setNewRewardName('');
      setNewRewardCost('');
      toast.success('Reward created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create reward');
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
          {rewards.map((reward) => (
            <RewardCard
              key={reward.id}
              reward={reward}
              userPoints={totalPoints}
              onRedeem={handleRedeem}
              isLoading={redeemingId === reward.id}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
