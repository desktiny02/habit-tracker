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
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      {!canAfford && (
        <div
          className="absolute top-0 right-0 text-xs px-3 py-1 rounded-bl-xl font-medium"
          style={{
            backgroundColor: 'var(--bg-raised)',
            color: 'var(--text-muted)',
          }}
        >
          Need {reward.cost - userPoints} more
        </div>
      )}

      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--accent-subtle)' }}
        >
          <Gift style={{ color: 'var(--accent)', width: 20, height: 20 }} />
        </div>
        <div>
          <h3
            className="font-semibold text-base leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {reward.name}
          </h3>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {reward.cost} pts
          </p>
        </div>
      </div>

      <Button
        variant={canAfford ? 'primary' : 'secondary'}
        className="w-full"
        disabled={!canAfford || isLoading}
        onClick={() => onRedeem(reward)}
      >
        {isLoading ? 'Redeeming…' : canAfford ? 'Redeem' : 'Not Enough Points'}
      </Button>
    </div>
  );
}
