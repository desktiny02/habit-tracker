import React from 'react';
import { Reward } from '@/types';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
  isLoading: boolean;
}

export function RewardCard({ reward, userPoints, onRedeem, isLoading }: RewardCardProps) {
  const canAfford = userPoints >= reward.cost;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden transition-all hover:shadow-md">
      {!canAfford && (
        <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-bl-xl font-medium">
          Need {reward.cost - userPoints} more
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
          <Gift className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-lg leading-tight">{reward.name}</h3>
          <p className="text-slate-500 text-sm font-medium mt-1">{reward.cost} pts</p>
        </div>
      </div>
      <Button 
        variant={canAfford ? 'primary' : 'secondary'} 
        className="w-full shadow-sm mt-2"
        disabled={!canAfford || isLoading}
        onClick={() => onRedeem(reward)}
      >
        {isLoading ? 'Redeeming...' : canAfford ? 'Redeem Reward' : 'Not Enough Points'}
      </Button>
    </div>
  );
}
