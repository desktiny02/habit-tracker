'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth';
import { createTask } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewTaskPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts <= 0) return toast.error("Points must be a positive number");

    setLoading(true);
    try {
      await createTask({
        userId: user.uid,
        name,
        points: pts,
        repeatType: 'daily'
      });
      toast.success("Task created successfully!");
      router.push('/');
    } catch (err: any) {
      toast.error(err.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Create New Task</h1>

        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Task Name</label>
            <Input 
              type="text" 
              required
              placeholder="e.g. Read for 30 minutes, Drink water..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Completion Points</label>
            <Input 
              type="number" 
              required
              min="1"
              placeholder="e.g. 50"
              value={points}
              onChange={e => setPoints(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
            <p className="text-xs text-slate-500 mt-2">
              You will earn these points when you complete the task daily. If missed, you'll lose half the points.
            </p>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creating...' : 'Create Daily Task'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
