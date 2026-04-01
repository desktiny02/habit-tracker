import React, { useState } from 'react';
import { Reward } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, X, Plane, Dumbbell, Gamepad2, Gift, Sparkles } from 'lucide-react';

interface RewardCardProps {
  reward: Reward;
  userPoints: number;
  onRedeem: (reward: Reward) => void;
  onDelete?: (reward: Reward) => void;
  isLoading: boolean;
}

/* Map reward name keywords to icons */
function getRewardIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('trip') || lower.includes('travel') || lower.includes('flight')) return Plane;
  if (lower.includes('massage') || lower.includes('gym') || lower.includes('sport') || lower.includes('wellness')) return Dumbbell;
  if (lower.includes('game') || lower.includes('play')) return Gamepad2;
  if (lower.includes('spa') || lower.includes('salon')) return Sparkles;
  return Gift;
}

export function RewardCard({ reward, userPoints, onRedeem, onDelete, isLoading }: RewardCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const canAfford = userPoints >= reward.cost;
  const progress = Math.min(100, Math.round((userPoints / reward.cost) * 100));
  const Icon = getRewardIcon(reward.name);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all duration-200 group"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
      }}
    >
      {/* Top row: Icon + Delete */}
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: canAfford
              ? 'linear-gradient(135deg, rgba(124,110,245,0.2), rgba(90,110,240,0.12))'
              : 'rgba(255,255,255,0.04)',
            border: canAfford
              ? '1px solid rgba(124,110,245,0.3)'
              : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Icon style={{ 
            width: 22, height: 22, 
            color: canAfford ? 'var(--accent)' : 'var(--text-muted)' 
          }} />
        </div>

        {onDelete && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {showDelete ? (
              <>
                <button
                  onClick={() => setShowDelete(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
                <button
                  onClick={() => onDelete(reward)}
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                disabled={isLoading}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reward info */}
      <div className="flex-1">
        <h3
          className="font-bold text-base leading-snug"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          {reward.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
            {reward.cost} pts
          </span>
          {reward.category && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              · {reward.category}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar (if can't afford) */}
      {!canAfford && (
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Need {reward.cost - userPoints} more pts
            </p>
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{progress}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, rgba(124,110,245,0.5), rgba(90,110,240,0.7))',
              }}
            />
          </div>
        </div>
      )}

      {/* Ready to redeem badge */}
      {canAfford && (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--success)' }}>
            Ready to Redeem
          </span>
        </div>
      )}

      {/* Redeem button */}
      <button
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
        disabled={!canAfford || isLoading}
        onClick={() => onRedeem(reward)}
        style={
          canAfford
            ? {
                background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(124,110,245,0.4)',
              }
            : {
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }
        }
        onMouseEnter={(e) => {
          if (canAfford) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(124,110,245,0.6)';
        }}
        onMouseLeave={(e) => {
          if (canAfford) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(124,110,245,0.4)';
        }}
      >
        {isLoading ? 'Redeeming…' : canAfford ? 'Redeem' : 'Not Enough Points'}
      </button>
    </div>
  );
}
