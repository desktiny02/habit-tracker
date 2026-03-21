import React, { useState } from 'react';
import { Reward } from '@/types';
import { Button } from '@/components/ui/button';
import { Gift, Trash2, X } from 'lucide-react';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
  onDelete?: (reward: Reward) => void;
  isLoading: boolean;
}

export function RewardCard({ reward, userPoints, onRedeem, onDelete, isLoading }: RewardCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const canAfford = userPoints >= reward.cost;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex justify-between items-start">
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
        
        {onDelete && (
          <div className="flex items-center gap-2">
            {showDelete ? (
              <>
                <button
                  onClick={() => setShowDelete(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                  title="Cancel"
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
                <button
                  onClick={() => onDelete(reward)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 shadow-md"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                  title="Confirm delete"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                disabled={isLoading}
                title="Delete Reward"
                className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 style={{ width: 16, height: 16 }} />
              </button>
            )}
          </div>
        )}
      </div>

      {!canAfford && !showDelete && (
        <div
          className="text-xs font-medium mt-1 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          Need {reward.cost - userPoints} more points
        </div>
      )}

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
