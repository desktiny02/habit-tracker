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

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardCost, setNewRewardCost] = useState('');

  useEffect(() => {
    if (!user) return;

    // Realtime points listener
    const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setTotalPoints(docSnap.data().totalPoints || 0);
      }
    });

    const loadRewards = async () => {
      try {
        const q = query(collection(db, 'rewards'), where('userId', '==', user.uid));
        const snaps = await getDocs(q);
        setRewards(snaps.docs.map(d => ({ ...d.data(), id: d.id } as Reward)));
      } catch (err) {
        toast.error("Failed to load rewards");
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
      toast.success(`Redeemed ${reward.name}!`);
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
    if (isNaN(cost) || cost <= 0) return toast.error("Cost must be a positive number");
    
    try {
      const docRef = await addDoc(collection(db, 'rewards'), {
        userId: user.uid,
        name: newRewardName,
        cost
      });
      const newReward: Reward = { id: docRef.id, userId: user.uid, name: newRewardName, cost };
      setRewards(prev => [...prev, newReward]);
      setShowForm(false);
      setNewRewardName('');
      setNewRewardCost('');
      toast.success("Reward created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create reward");
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-indigo-600 text-transparent bg-clip-text">Rewards</h1>
          <p className="text-slate-500 mt-1 font-medium">Available Points: <span className="text-indigo-600 font-bold text-lg">{totalPoints}</span></p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'} className="rounded-full shadow-md font-semibold">
          {showForm ? 'Cancel' : 'New Reward'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateReward} className="bg-white p-6 rounded-3xl shadow-sm border border-indigo-100 mb-8 flex flex-col md:flex-row gap-4 items-end transition-all">
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Reward Name</label>
            <Input 
              type="text" 
              required
              placeholder="e.g. Treat myself to ice cream"
              value={newRewardName}
              onChange={e => setNewRewardName(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
          </div>
          <div className="w-full md:w-32 relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Cost (pts)</label>
            <Input 
              type="number" 
              required
              min="1"
              placeholder="100"
              value={newRewardCost}
              onChange={e => setNewRewardCost(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
          </div>
          <Button type="submit" className="w-full md:w-auto h-11 px-8 shadow-sm font-semibold">Save</Button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin"></div>
        </div>
      ) : rewards.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
          <div className="text-4xl mb-3">🎁</div>
          <h3 className="text-lg font-semibold text-slate-700">No rewards yet</h3>
          <p className="text-slate-500 mt-1">Create some rewards to treat yourself for your hard work!</p>
          <Button onClick={() => setShowForm(true)} className="mt-6" variant="outline">
            Create First Reward
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rewards.map(reward => (
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
