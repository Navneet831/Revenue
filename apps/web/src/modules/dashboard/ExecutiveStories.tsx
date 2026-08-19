import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, X, Sparkles, TrendingUp, AlertCircle, Target,
    ArrowRight, Pause, Play, Volume2, VolumeX, Heart, Send, MessageSquare,
    Share2, Check, MessageCircle, User, Clock
} from 'lucide-react';
import { useStore } from '@revenue/store/useStore';
import { supabase, useAuthStore } from '@grew/auth';
import { Insight } from '@revenue/shared';

import { CacheService } from '../../services/cacheService';

export interface StoryComment {
    id: string;
    story_id: string;
    user_email: string;
    user_name?: string;
    comment: string;
    created_at: string;
}

export interface StoryLikeUser {
    user_email: string;
    user_name?: string;
    created_at?: string;
}

export interface StoryItem {
    id: string;
    type?: 'insight' | 'image' | 'video' | 'kpi';
    mediaUrl?: string;
    duration?: number;
    insight?: Insight;
    title?: string;
    subtitle?: string;
    caption?: string;
    timestamp?: string;
    chartData?: number[];
    author?: {
        name: string;
        avatar?: string;
        badge?: string;
    };
    cta?: {
        label: string;
        action?: string;
    };
}

export const ExecutiveStories: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { stats, setUnviewedStories } = useStore();
    const { user } = useAuthStore();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

    // Supabase & Redis-Cached Social Data (Likes & Comments Map per Story)
    const [likedStories, setLikedStories] = useState<Record<string, boolean>>(() => {
        return CacheService.get<Record<string, boolean>>('user_liked_stories') || {};
    });
    const [likeCounts, setLikeCounts] = useState<Record<string, number>>(() => {
        return CacheService.get<Record<string, number>>('story_like_counts') || {};
    });
    const [likesByStory, setLikesByStory] = useState<Record<string, StoryLikeUser[]>>(() => {
        return CacheService.get<Record<string, StoryLikeUser[]>>('likes_by_story_map') || {};
    });
    const [commentsByStory, setCommentsByStory] = useState<Record<string, StoryComment[]>>(() => {
        return CacheService.get<Record<string, StoryComment[]>>('comments_by_story_map') || {};
    });
    const [showComments, setShowComments] = useState(false);
    const [showLikes, setShowLikes] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [replySent, setReplySent] = useState(false);
    const [animatingHeart, setAnimatingHeart] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressIntervalRef = useRef<number | null>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const rawStories: Insight[] = useMemo(() => {
        if (stats?.storyInsights && stats.storyInsights.length > 0) {
            return stats.storyInsights;
        }
        if (stats?.insights && stats.insights.length > 0) {
            return stats.insights.slice(0, 5);
        }
        return [
            {
                t: 'success',
                l: 'Revenue Milestone',
                txt: 'Monthly dispatch target pacing exceeds budget by 14.2% across utility modules.',
                cta: { label: 'Explore Velocity', action: 'explore' }
            },
            {
                t: 'strategic',
                l: 'PVM Realization',
                txt: 'Average realization per watt stabilized at optimal tier, lifting gross margins by 180 bps.',
                cta: { label: 'View Realization', action: 'realization' }
            },
            {
                t: 'risk',
                l: 'Inventory Pacing',
                txt: 'Raw material transit lead times contracted. Warehouse buffer remains at 22 days.',
                cta: { label: 'Audit Supply', action: 'audit' }
            }
        ];
    }, [stats]);

    const storyQueue: StoryItem[] = useMemo(() => {
        return rawStories.map((ins, idx) => {
            const chartDataSets = [
                [35, 50, 42, 68, 75, 92, 88],
                [60, 55, 70, 65, 80, 85, 95],
                [80, 75, 60, 50, 45, 40, 35],
                [40, 60, 55, 75, 80, 70, 90],
                [50, 65, 75, 85, 80, 95, 100],
            ];

            return {
                id: `story-${idx}`,
                type: 'insight',
                duration: 6500,
                insight: ins,
                title: ins.l || 'Executive Intelligence',
                subtitle: `Quant Story ${idx + 1} of ${rawStories.length}`,
                caption: ins.txt,
                timestamp: `${idx * 2 + 1}h ago`,
                chartData: chartDataSets[idx % chartDataSets.length],
                author: {
                    name: 'Grew Executive Desk',
                    badge: 'Verified KPI',
                },
                cta: ins.cta
            };
        });
    }, [rawStories]);

    const currentStory = storyQueue[currentIndex] || storyQueue[0];
    const currentStoryComments: StoryComment[] = useMemo(() => {
        return commentsByStory[currentStory?.id] || [];
    }, [commentsByStory, currentStory?.id]);
    const currentStoryLikes: StoryLikeUser[] = useMemo(() => {
        return likesByStory[currentStory?.id] || [];
    }, [likesByStory, currentStory?.id]);

    // Load Likes and Comments for all stories with Cache + Supabase background revalidation
    const loadSocialData = useCallback(async () => {
        try {
            // 1. Fetch Likes from Supabase with user details
            const { data: likesData } = await supabase
                .from('story_likes')
                .select('story_id, user_email, created_at');

            if (likesData) {
                const userLikes: Record<string, boolean> = {};
                const counts: Record<string, number> = {};
                const lMap: Record<string, StoryLikeUser[]> = {};

                likesData.forEach((row: { story_id: string; user_email: string; created_at?: string }) => {
                    counts[row.story_id] = (counts[row.story_id] || 0) + 1;
                    if (user?.email && row.user_email.toLowerCase() === user.email.toLowerCase()) {
                        userLikes[row.story_id] = true;
                    }
                    if (!lMap[row.story_id]) {
                        lMap[row.story_id] = [];
                    }
                    lMap[row.story_id].push({
                        user_email: row.user_email,
                        user_name: row.user_email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        created_at: row.created_at
                    });
                });
                setLikeCounts(counts);
                setLikedStories(userLikes);
                setLikesByStory(lMap);

                CacheService.set('story_like_counts', counts, 300);
                CacheService.set('user_liked_stories', userLikes, 300);
                CacheService.set('likes_by_story_map', lMap, 300);
            }

            // 2. Fetch All Comments and group strictly by story_id
            const { data: allCommentsData } = await supabase
                .from('story_comments')
                .select('id, story_id, user_email, user_name, comment, created_at')
                .order('created_at', { ascending: true });

            if (allCommentsData) {
                const map: Record<string, StoryComment[]> = {};
                allCommentsData.forEach((row: StoryComment) => {
                    if (!map[row.story_id]) {
                        map[row.story_id] = [];
                    }
                    map[row.story_id].push(row);
                });
                setCommentsByStory(map);
                CacheService.set('comments_by_story_map', map, 360);
            }
        } catch (err) {
            console.warn('[ExecutiveStories] Failed to load social data:', err);
        }
    }, [user?.email]);

    // Load social data on mount & whenever user changes
    useEffect(() => {
        loadSocialData();
    }, [loadSocialData]);

    // Mark stories as viewed
    useEffect(() => {
        if (isOpen) {
            setUnviewedStories(false);
        }
    }, [isOpen, setUnviewedStories]);

    // Navigation callbacks
    const nextStory = useCallback(() => {
        if (currentIndex < storyQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
            setReplySent(false);
            setReplyText('');
            setShowComments(false);
        } else {
            onClose();
            setCurrentIndex(0);
            setProgress(0);
        }
    }, [currentIndex, storyQueue.length, onClose]);

    const prevStory = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
            setReplySent(false);
            setReplyText('');
            setShowComments(false);
        } else {
            setProgress(0);
        }
    }, [currentIndex]);

    // Timer & Video Synchronization Loop
    useEffect(() => {
        if (!isOpen || storyQueue.length === 0) return;

        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }

        const isVideo = currentStory?.type === 'video' && videoRef.current;
        const totalDuration = isVideo && videoRef.current?.duration
            ? videoRef.current.duration * 1000
            : (currentStory?.duration || 6000);

        const updateInterval = 40;

        progressIntervalRef.current = window.setInterval(() => {
            if (isPaused || showComments) return;

            setProgress(prev => {
                if (isVideo && videoRef.current) {
                    const videoTime = videoRef.current.currentTime;
                    const videoDur = videoRef.current.duration || (totalDuration / 1000);
                    const pct = (videoTime / videoDur) * 100;
                    if (pct >= 99.5 || videoRef.current.ended) {
                        nextStory();
                        return 0;
                    }
                    return pct;
                }

                const step = (updateInterval / totalDuration) * 100;
                const nextVal = prev + step;
                if (nextVal >= 100) {
                    nextStory();
                    return 0;
                }
                return nextVal;
            });
        }, updateInterval);

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [isOpen, currentIndex, isPaused, showComments, currentStory, storyQueue.length, nextStory]);

    // Handle Keyboard shortcuts (Ignoring when user is typing in an input/textarea)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isTyping =
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA' ||
                target?.isContentEditable;

            // When typing a comment, allow normal space and arrow keys
            if (isTyping) {
                if (e.key === 'Escape') {
                    (target as HTMLElement)?.blur();
                }
                return;
            }

            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextStory();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevStory();
            } else if (e.key.toLowerCase() === 'm') {
                setIsMuted(prev => !prev);
            } else if (e.key.toLowerCase() === 'p') {
                setIsPaused(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextStory, prevStory, onClose]);

    // Touch / Swipe Gestures for Mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };
        setIsPaused(true);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setIsPaused(false);
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - touchStartRef.current.x;
        const diffY = touch.clientY - touchStartRef.current.y;
        const timeDiff = Date.now() - touchStartRef.current.time;

        touchStartRef.current = null;

        // Swipe Down to Close
        if (diffY > 80 && Math.abs(diffX) < 60) {
            onClose();
            return;
        }

        // Swipe Left -> Next Story
        if (diffX < -50 && Math.abs(diffY) < 60) {
            nextStory();
            return;
        }

        // Swipe Right -> Prev Story
        if (diffX > 50 && Math.abs(diffY) < 60) {
            prevStory();
            return;
        }

        // Tap Left vs Right (Short tap < 250ms)
        if (timeDiff < 250 && Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
            const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
            const tapX = touch.clientX;
            if (tapX < containerWidth * 0.35) {
                prevStory();
            } else {
                nextStory();
            }
        }
    };

    // Supabase Like Toggle (Story Specific)
    const handleLike = async () => {
        if (!currentStory) return;

        const storyId = currentStory.id;
        const userEmail = user?.email || 'executive@grew.com';
        const currentlyLiked = !!likedStories[storyId];
        const newStatus = !currentlyLiked;

        // Optimistic update
        const updatedLiked = { ...likedStories, [storyId]: newStatus };
        const updatedCounts = {
            ...likeCounts,
            [storyId]: Math.max(0, (likeCounts[storyId] || 0) + (newStatus ? 1 : -1))
        };

        setLikedStories(updatedLiked);
        setLikeCounts(updatedCounts);

        CacheService.set('user_liked_stories', updatedLiked, 600);
        CacheService.set('story_like_counts', updatedCounts, 600);

        if (newStatus) {
            setAnimatingHeart(true);
            setTimeout(() => setAnimatingHeart(false), 900);
        }

        try {
            if (newStatus) {
                await supabase
                    .from('story_likes')
                    .upsert([{ story_id: storyId, user_email: userEmail }], { onConflict: 'story_id,user_email' });
            } else {
                await supabase
                    .from('story_likes')
                    .delete()
                    .eq('story_id', storyId)
                    .ilike('user_email', userEmail);
            }
        } catch (err) {
            console.error('[ExecutiveStories] Failed to update like:', err);
        }
    };

    // Supabase Comment Submission (Story Specific)
    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !currentStory) return;

        const storyId = currentStory.id;
        const commentText = replyText.trim();
        const userEmail = user?.email || 'executive@grew.com';
        const displayName = user?.name || userEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase());

        setIsSubmittingComment(true);

        const newComment: StoryComment = {
            id: `temp-${Date.now()}`,
            story_id: storyId,
            user_email: userEmail,
            user_name: displayName,
            comment: commentText,
            created_at: new Date().toISOString()
        };

        // Update local map strictly for this specific story
        const existingForThisStory = commentsByStory[storyId] || [];
        const updatedForThisStory = [...existingForThisStory, newComment];
        const updatedMap = {
            ...commentsByStory,
            [storyId]: updatedForThisStory
        };

        setCommentsByStory(updatedMap);
        setReplyText('');
        setReplySent(true);

        // Update persistent cache immediately with randomized jitter
        CacheService.set('comments_by_story_map', updatedMap, 360);

        try {
            const { data, error } = await supabase
                .from('story_comments')
                .insert([{
                    story_id: storyId,
                    user_email: userEmail,
                    user_name: displayName,
                    comment: commentText
                }])
                .select('*')
                .single();

            if (!error && data) {
                const finalStoryComments = updatedForThisStory.map(c => c.id === newComment.id ? data : c);
                const finalMap = {
                    ...updatedMap,
                    [storyId]: finalStoryComments
                };
                setCommentsByStory(finalMap);
                CacheService.set('comments_by_story_map', finalMap, 360);
            } else if (error) {
                console.error('[ExecutiveStories] Supabase comment insert error:', error.message);
            }
        } catch (err) {
            console.error('[ExecutiveStories] Failed to save comment:', err);
        } finally {
            setIsSubmittingComment(false);
            setTimeout(() => setReplySent(false), 2000);
        }
    };

    if (!isOpen || storyQueue.length === 0) return null;

    const insightType = currentStory.insight?.t || 'strategic';
    const isLiked = !!likedStories[currentStory.id];
    const totalLikes = likeCounts[currentStory.id] || 0;
    const totalStoryComments = currentStoryComments.length;

    return (
        <div
            className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center select-none overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Executive Stories Viewer"
        >
            {/* Desktop Surrounding Backdrop and Previous/Next Controls */}
            <button
                onClick={prevStory}
                disabled={currentIndex === 0}
                className={`hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 shadow-xl transition-all active:scale-95 ${
                    currentIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'opacity-90 hover:opacity-100'
                }`}
                aria-label="Previous Story"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>

            <button
                onClick={nextStory}
                className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full items-center justify-center bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 shadow-xl transition-all active:scale-95 opacity-90 hover:opacity-100"
                aria-label="Next Story"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Desktop Top Close Shortcut */}
            <button
                onClick={onClose}
                className="hidden md:flex absolute top-6 right-6 z-50 p-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600 shadow-xl transition-all"
                aria-label="Close Stories (Esc)"
            >
                <X className="w-6 h-6" />
            </button>

            {/* Story & Side-by-Side Panel Flex Wrapper: Story on Left/Center, Side Panel on RIGHT */}
            <div className="relative flex flex-col md:flex-row items-center justify-center gap-5 max-h-full max-w-full z-20">
                {/* Main Story Container: High contrast solid OKLCH / Slate surface */}
                <div
                    ref={containerRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="relative w-full h-full md:h-[92vh] md:max-h-[880px] md:w-auto md:aspect-[9/16] md:max-w-[480px] bg-slate-900 md:rounded-[36px] shadow-2xl overflow-hidden flex flex-col border border-slate-700 shrink-0"
                >
                    {/* Background Layer: High contrast solid slate dark surface with subtle ambient accent */}
                    <div className="absolute inset-0 z-0 bg-slate-950">
                        {currentStory.type === 'video' && currentStory.mediaUrl ? (
                            <video
                                ref={videoRef}
                                src={currentStory.mediaUrl}
                                autoPlay
                                playsInline
                                muted={isMuted}
                                className="w-full h-full object-cover"
                            />
                        ) : currentStory.type === 'image' && currentStory.mediaUrl ? (
                            <img
                                src={currentStory.mediaUrl}
                                alt={currentStory.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            /* Clean solid dark background with subtle highlight */
                            <div className="relative w-full h-full bg-slate-950 p-6">
                                <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-slate-900 to-transparent opacity-80" />
                                <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                            </div>
                        )}
                    </div>

                    {/* Heart Pop Animation */}
                    {animatingHeart && (
                        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center animate-ping duration-700">
                            <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl" />
                        </div>
                    )}

                    {/* Top Overlay: Segmented Progress Bars */}
                    <div className="relative z-30 pt-3 px-4 md:px-5 flex gap-1.5 shrink-0 bg-slate-950/70 backdrop-blur-md pb-2">
                        {storyQueue.map((_, i) => (
                            <div key={i} className="h-1 flex-1 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-400 transition-none rounded-full"
                                    style={{
                                        width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%'
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Profile & Control Header */}
                    <div className="relative z-30 px-4 md:px-5 py-2 flex items-center justify-between shrink-0 bg-slate-950/70 backdrop-blur-md border-b border-slate-800/80">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white tracking-tight">
                                        {currentStory.author?.name || 'Grew Analytics'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {currentStory.timestamp}
                                    </span>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                                    {currentStory.subtitle}
                                </span>
                            </div>
                        </div>

                        {/* Quick Action Controls */}
                        <div className="flex items-center gap-1.5">
                            {currentStory.type === 'video' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMuted(m => !m);
                                    }}
                                    className="p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors"
                                    aria-label={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPaused(prev => !prev);
                                }}
                                className={`p-2 rounded-full border transition-all ${
                                    isPaused
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                                }`}
                                aria-label={isPaused ? "Resume Story" : "Pause Story"}
                                title={isPaused ? "Resume" : "Pause"}
                            >
                                {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                            </button>
                            <button
                                onClick={onClose}
                                className="md:hidden p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-full border border-slate-700 transition-colors"
                                aria-label="Close Story"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Central High-Contrast Content Area */}
                    <div className="relative z-20 flex-1 flex flex-col justify-between p-6 overflow-y-auto no-scrollbar">
                        <div className="space-y-4">
                            {/* Category Badge with High Contrast Solid Color */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm ${
                                insightType === 'success'
                                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                                    : insightType === 'risk'
                                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                                    : 'bg-sky-950/80 border-sky-500/40 text-sky-300'
                            }`}>
                                {insightType === 'success' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                                {insightType === 'risk' && <AlertCircle className="w-4 h-4 text-rose-400" />}
                                {insightType === 'strategic' && <Target className="w-4 h-4 text-sky-400" />}
                                <span className="text-[11px] font-black uppercase tracking-wider">
                                    {currentStory.title}
                                </span>
                            </div>

                            {/* High-Contrast Card for Insight Text */}
                            <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug tracking-tight">
                                    {currentStory.caption}
                                </h2>
                            </div>

                            {/* Data Card / Pacing Variance Sparkline with Solid Contrast Background */}
                            {currentStory.chartData && (
                                <div className="p-4 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-xl">
                                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                                        <span>Pacing & Trajectory</span>
                                        <span className="text-emerald-400 font-mono font-bold">+18.4% YoY</span>
                                    </div>
                                    <div className="flex items-end gap-2 h-20">
                                        {currentStory.chartData.map((val, idx) => (
                                            <div key={idx} className="flex-1 bg-slate-800 rounded-t-md relative h-full flex items-end overflow-hidden">
                                                <div
                                                    className="w-full bg-emerald-500 rounded-t-md transition-all duration-700"
                                                    style={{ height: `${val}%` }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom CTA button inside story */}
                        <div className="pt-3">
                            {currentStory.cta && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                    }}
                                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all text-xs uppercase tracking-wider"
                                >
                                    {currentStory.cta.label || 'Take Action'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bottom Action Bar: Likes, Comments Toggle, & Social Triggers */}
                    <div className="relative z-30 px-5 py-3.5 bg-slate-950 border-t border-slate-800 shrink-0 flex items-center justify-between">
                        {/* Open Comments Drawer Trigger Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowLikes(false);
                                setShowComments(prev => !prev);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-all ${
                                showComments
                                    ? 'bg-sky-600 border-sky-500 text-white shadow-lg'
                                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                            aria-label="View Comments"
                            title="Toggle Comments Panel"
                        >
                            <MessageSquare className="w-4 h-4 text-sky-400" />
                            <span>
                                {totalStoryComments > 0 ? `${totalStoryComments} ${totalStoryComments === 1 ? 'Comment' : 'Comments'}` : 'Comment'}
                            </span>
                        </button>

                        {/* Social Right Actions: Like Heart Button with Integrated Count & Liked People Drawer Trigger */}
                        <div className="flex items-center gap-2">
                            {/* Like Toggle Button with Integrated Counter Badge */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleLike();
                                }}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all active:scale-105 ${
                                    isLiked
                                        ? 'bg-rose-950/60 border-rose-500/50 text-rose-400'
                                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                                aria-label="Like Story"
                                title={isLiked ? "Unlike Story" : "Like Story"}
                            >
                                <Heart className={`w-4 h-4 ${isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-300'}`} />
                                {totalLikes > 0 && (
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowComments(false);
                                            setShowLikes(prev => !prev);
                                        }}
                                        className="text-xs font-mono font-bold text-rose-400 hover:underline cursor-pointer"
                                        title="Click to see who liked this story"
                                    >
                                        {totalLikes}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Left & Right Tap Zones (Tap Left: Prev, Tap Right: Next) */}
                    <div className="absolute inset-y-16 inset-x-0 z-10 flex pointer-events-auto">
                        <div
                            className="w-1/3 h-full cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                prevStory();
                            }}
                            aria-label="Previous story region"
                        />
                        <div
                            className="w-2/3 h-full cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                nextStory();
                            }}
                            aria-label="Next story region"
                        />
                    </div>
                </div>

                {/* Right Side-by-Side Likes Panel (Desktop) / Bottom Sheet (Mobile) */}
                {showLikes && (
                    <div className="w-full md:w-[360px] h-[360px] md:h-[92vh] md:max-h-[880px] bg-slate-900 border border-slate-700 md:rounded-[36px] shadow-2xl flex flex-col p-5 animate-in slide-in-from-right duration-200 z-30 shrink-0">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                                <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                                    Story Likes ({currentStoryLikes.length})
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowLikes(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Likes List */}
                        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 no-scrollbar">
                            {currentStoryLikes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                    <Heart className="w-8 h-8 text-slate-600 mb-2" />
                                    <p className="text-xs font-semibold text-slate-300">No likes yet</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Be the first to like this executive story.</p>
                                </div>
                            ) : (
                                currentStoryLikes.map((lk, idx) => (
                                    <div key={idx} className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between shadow-sm hover:border-slate-700 transition-all">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-xs font-bold text-rose-400 shrink-0">
                                                {(lk.user_name || lk.user_email).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-bold text-slate-100 truncate">
                                                    {lk.user_name || lk.user_email.split('@')[0]}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                                    {lk.user_email}
                                                </span>
                                            </div>
                                        </div>
                                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0 ml-2" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Right Side-by-Side Comments Panel (Desktop) / Bottom Sheet (Mobile) */}
                {showComments && (
                    <div className="w-full md:w-[380px] h-[360px] md:h-[92vh] md:max-h-[880px] bg-slate-900 border border-slate-700 md:rounded-[36px] shadow-2xl flex flex-col p-5 animate-in slide-in-from-right duration-200 z-30 shrink-0">
                        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-sky-400" />
                                <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                                    {currentStory.title} Comments ({totalStoryComments})
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowComments(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Comment List */}
                        <div className="flex-1 overflow-y-auto py-3 space-y-3 no-scrollbar">
                            {currentStoryComments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                    <MessageSquare className="w-8 h-8 text-slate-600 mb-2" />
                                    <p className="text-xs font-semibold text-slate-300">No comments on this story yet</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Be the first to share your thoughts on this story.</p>
                                </div>
                            ) : (
                                currentStoryComments.map((cmt) => (
                                    <div key={cmt.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col gap-2 shadow-md">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-400">
                                                    {(cmt.user_name || cmt.user_email).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-100 leading-tight">
                                                        {cmt.user_name || cmt.user_email.split('@')[0]}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {cmt.user_email}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-slate-500 font-mono text-[10px] flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {new Date(cmt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
                                            <p className="text-xs text-slate-200 leading-relaxed break-words font-medium">
                                                {cmt.comment}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Dedicated Single Comment Input Inside the Right Panel */}
                        <form onSubmit={handleSendComment} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                            <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onFocus={() => setIsPaused(true)}
                                placeholder="Add a public comment..."
                                className="flex-1 py-2 px-3.5 bg-slate-950 border border-slate-700 rounded-full text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={!replyText.trim() || isSubmittingComment}
                                className="p-2 rounded-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-all shadow-sm"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
