import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PenSquare,
  RefreshCw,
  MapPin,
  ExternalLink,
  Flame,
  ChevronDown,
  ChevronLeft,
  Newspaper,
  Code2,
  Sparkles,
  FlaskConical,
  TrendingUp,
  Coins,
  Landmark,
  Trophy,
  Film,
  Heart,
  Bookmark,
  GraduationCap,
  Leaf,
  Briefcase,
  Coffee,
  Shield,
  Globe,
  Languages,
  Clock,
  Share2,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PostList } from "@/components/posts/PostList";
import { ShareDialog } from "@/components/posts/ShareDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRecommendFeed, useFollowingFeed, useFriendsFeed, useNearbyFeed } from "@/hooks/useFeedTabs";
import { usePostLike, usePostCollection, useDeletePost } from "@/hooks/useFeed";
import { useAggregatedFeed, useSimilarArticles, type AggregatedFeedItem, type FeedVideoInfo, type FeedImageInfo } from "@/hooks/useAggregatedFeed";
import { useFeedCategories, getCategoryColorClasses, type FeedCategory } from "@/hooks/useFeedCategories";
import { useFeedItemStatus, useFeedLike, useFeedBookmark } from "@/hooks/useFeedInteractions";
import { useFeedTranslation } from "@/hooks/useFeedTranslation";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocationPermission } from "@/hooks/useLocationPermission";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

type FeedTab = "discover" | "recommend" | "following" | "friends" | "nearby";

const TABS: { key: FeedTab; label: string }[] = [
  { key: "discover", label: "发现" },
  { key: "recommend", label: "推荐" },
  { key: "following", label: "关注" },
  { key: "friends", label: "好友" },
  { key: "nearby", label: "附近" },
];

// --- HTML stripping for display ---

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Strip zero-width / invisible characters often found in RSS feeds
    .replace(/&zwnj;/g, "")
    .replace(/&zwj;/g, "")
    .replace(/&shy;/g, "")
    .replace(/&lrm;/g, "")
    .replace(/&rlm;/g, "")
    // Strip remaining named/numeric HTML entities
    .replace(/&[a-zA-Z]+;/g, "")
    .replace(/&#x[0-9a-fA-F]+;/g, "")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Source helpers ---

/** Map icon names from feed_categories to Lucide components (static map, no wildcard import) */
const ICON_MAP: Record<string, LucideIcon> = {
  Newspaper, Code2, Sparkles, FlaskConical, TrendingUp,
  Coins, Landmark, Trophy, Film, Heart, GraduationCap,
  Leaf, Briefcase, Coffee, Shield, Globe, Flame,
};

function getLucideIcon(name: string | null, className = "h-3.5 w-3.5"): React.ReactNode {
  if (!name) return <Flame className={className} />;
  const Icon = ICON_MAP[name] || Flame;
  return <Icon className={className} />;
}

function getSourceLabel(source: string): string {
  if (source === "hackernews") return "Hacker News";
  if (source === "reddit") return "Reddit";
  return source.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function getCategoryLabel(tags: string[], categoriesMap: Map<string, FeedCategory>): string | null {
  for (const tag of tags) {
    const cat = categoriesMap.get(tag);
    if (cat) return cat.label_zh;
  }
  if (tags.includes("worldnews")) return "国际";
  if (tags.includes("programming")) return "编程";
  return null;
}

function getCategoryColor(tags: string[], categoriesMap: Map<string, FeedCategory>): string {
  for (const tag of tags) {
    const cat = categoriesMap.get(tag);
    if (cat) return getCategoryColorClasses(cat.color_class);
  }
  return "bg-muted text-muted-foreground";
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "";
  }
}

// --- Sanitize HTML: strip dangerous tags but keep content formatting ---

function sanitizeHtml(html: string): string {
  // Remove script, style, iframe (except YouTube/Vimeo), object, embed tags
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "") // remove event handlers
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, ""); // remove javascript: URIs
  // Remove iframes that are NOT YouTube/Vimeo
  clean = clean.replace(/<iframe[^>]*src=["'](?!https?:\/\/(?:www\.)?(?:youtube\.com|player\.vimeo\.com))[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi, "");
  return clean;
}

// Inject extra images into HTML at paragraph boundaries (evenly spaced)
function injectImagesIntoHtml(html: string, images: FeedImageInfo[]): string {
  if (!images.length || !html) return html;
  const parts = html.split("</p>");
  const paraCount = parts.length - 1;
  if (paraCount <= 0) return html;
  const insertions = new Map<number, FeedImageInfo>();
  const interval = Math.max(1, Math.ceil(paraCount / (images.length + 1)));
  images.forEach((img, i) => {
    insertions.set(Math.min(interval * (i + 1) - 1, paraCount - 1), img);
  });
  return parts.map((part, i) => {
    if (i === parts.length - 1) return part;
    let chunk = part + "</p>";
    const img = insertions.get(i);
    if (img && /^https?:\/\//.test(img.url)) {
      const alt = (img.alt || "")
        .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
        .replace(/</g, "&lt;").replace(/>/g, "&gt;");
      chunk += `<figure style="margin:1.25rem 0"><img src="${img.url}" alt="${alt}" loading="lazy" style="width:100%;border-radius:0.75rem;display:block" />${alt ? `<figcaption style="font-size:0.75rem;padding:0.375rem 0.75rem;font-style:italic;opacity:0.6">${alt}</figcaption>` : ""}</figure>`;
    }
    return chunk;
  }).join("");
}

// --- Video embed component ---

function VideoEmbed({ video }: { video: FeedVideoInfo }) {
  if (video.type === "youtube" || video.type === "vimeo") {
    return (
      <div className="my-4 rounded-xl overflow-hidden bg-muted aspect-video">
        <iframe
          src={video.url}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="Video"
        />
      </div>
    );
  }
  if (video.type === "mp4") {
    return (
      <div className="my-4 rounded-xl overflow-hidden bg-muted">
        <video src={video.url} controls className="w-full" preload="metadata">
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }
  return null;
}

// --- Feed Detail Panel (in-app article reader) ---

function FeedDetailPanel({
  item,
  categoriesMap,
  onClose,
  isLiked,
  isBookmarked,
  onLike,
  onBookmark,
  translatedTitle,
  translatedContent,
}: {
  item: AggregatedFeedItem;
  categoriesMap: Map<string, FeedCategory>;
  onClose: () => void;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onLike?: (feedId: string, isLiked: boolean) => void;
  onBookmark?: (feedId: string, isBookmarked: boolean) => void;
  translatedTitle?: string | null;
  translatedContent?: string | null;
}) {
  const categoryLabel = getCategoryLabel(item.tags, categoriesMap);
  const displayTitle = translatedTitle || item.title;

  // Use full_content if available, fallback to content
  const hasFullContent = item.full_content_status === "fetched" && item.full_content;
  const rawContent = translatedContent || (hasFullContent ? item.full_content : item.content) || "";
  const displayContent = hasFullContent ? rawContent : stripHtml(rawContent);

  // Parse images array (may be JSON string or array)
  const extractedImages: FeedImageInfo[] = useMemo(() => {
    if (!item.images) return [];
    if (Array.isArray(item.images)) return item.images as FeedImageInfo[];
    try { return JSON.parse(item.images as unknown as string) || []; } catch { return []; }
  }, [item.images]);

  // Best hero image: prefer first extracted image (high-res, stored in Supabase), fall back to RSS thumbnail
  const heroImage = extractedImages[0]?.url || item.image_url;

  // Parse videos from item
  const videos: FeedVideoInfo[] = useMemo(() => {
    if (!item.videos) return [];
    if (Array.isArray(item.videos)) return item.videos;
    try { return JSON.parse(item.videos as unknown as string) || []; } catch { return []; }
  }, [item.videos]);

  // Extra images (skip hero at index 0) for interleaving
  const extraImages = useMemo(() => extractedImages.slice(1), [extractedImages]);

  // For plain-text articles: split into paragraphs for image interleaving
  const plainParagraphs = useMemo(() => {
    if (hasFullContent || !displayContent) return [];
    return displayContent.split(/\n\n+/).filter((p) => p.trim().length > 0);
  }, [hasFullContent, displayContent]);

  // Map: paragraph index → image to insert after it
  const plainImageInsertions = useMemo(() => {
    const map = new Map<number, FeedImageInfo>();
    if (!extraImages.length || !plainParagraphs.length) return map;
    const interval = Math.max(1, Math.ceil(plainParagraphs.length / (extraImages.length + 1)));
    extraImages.forEach((img, i) => {
      map.set(Math.min(interval * (i + 1) - 1, plainParagraphs.length - 1), img);
    });
    return map;
  }, [extraImages, plainParagraphs]);

  const handleShare = async () => {
    if (navigator.share && item.url) {
      try {
        await navigator.share({ title: item.title || "", url: item.url });
      } catch { /* user cancelled */ }
    } else if (item.url) {
      await navigator.clipboard.writeText(item.url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-muted-foreground truncate block">
            {getSourceLabel(item.source)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onLike?.(item.id, !!isLiked)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-400"
            )}
          >
            <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
          </button>
          <button
            onClick={() => onBookmark?.(item.id, !!isBookmarked)}
            className={cn(
              "p-2 rounded-full transition-colors",
              isBookmarked ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"
            )}
          >
            <Bookmark className={cn("h-5 w-5", isBookmarked && "fill-current")} />
          </button>
          <button onClick={handleShare} className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Article body */}
      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-4 py-6">
          {/* Category + time + word count */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {categoryLabel && (
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded",
                getCategoryColor(item.tags, categoriesMap)
              )}>
                {categoryLabel}
              </span>
            )}
            {item.published_at && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(item.published_at)}
              </span>
            )}
            {item.word_count && item.word_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {item.word_count > 1000 ? `${(item.word_count / 1000).toFixed(1)}k` : item.word_count} 字
              </span>
            )}
          </div>

          {/* Title */}
          {displayTitle && (
            <h1 className="text-xl font-bold leading-tight mb-4 text-foreground">
              {displayTitle}
            </h1>
          )}

          {/* Author */}
          {item.author_name && (
            <div className="flex items-center gap-2 mb-4 pb-4 border-b">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {item.author_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-muted-foreground">{item.author_name}</span>
            </div>
          )}

          {/* Hero image: use extracted high-res image if available, else RSS thumbnail */}
          {heroImage && (
            <div className="rounded-xl overflow-hidden mb-6 bg-muted">
              <img
                src={heroImage}
                alt={extractedImages[0]?.alt || ""}
                className="w-full object-cover max-h-[360px]"
                onError={(e) => {
                  // If extracted image fails, fall back to RSS thumbnail
                  if (heroImage !== item.image_url && item.image_url) {
                    (e.target as HTMLImageElement).src = item.image_url;
                  } else {
                    (e.target as HTMLImageElement).parentElement!.style.display = "none";
                  }
                }}
              />
            </div>
          )}

          {/* Content: images injected at paragraph boundaries */}
          {hasFullContent ? (
            <div
              className="prose dark:prose-invert max-w-none
                prose-img:rounded-xl prose-img:my-4
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-foreground/90 prose-p:leading-relaxed
                prose-strong:text-foreground
                prose-li:text-foreground/90
                prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground
                leading-relaxed"
              dangerouslySetInnerHTML={{ __html: injectImagesIntoHtml(sanitizeHtml(displayContent), extraImages) }}
            />
          ) : displayContent ? (
            <div className="text-[15px] leading-relaxed text-foreground/90">
              {plainParagraphs.length > 0
                ? plainParagraphs.flatMap((para, i) => {
                    const img = plainImageInsertions.get(i);
                    const nodes = [
                      <p key={`p-${i}`} className="mb-3 whitespace-pre-line">{para}</p>,
                    ];
                    if (img) {
                      nodes.push(
                        <div key={`img-${i}`} className="my-4 rounded-xl overflow-hidden bg-muted">
                          <img
                            src={img.url}
                            alt={img.alt || ""}
                            className="w-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).parentElement!.style.display = "none";
                            }}
                          />
                          {img.alt && (
                            <p className="text-xs text-muted-foreground px-3 py-1.5 italic">{img.alt}</p>
                          )}
                        </div>
                      );
                    }
                    return nodes;
                  })
                : <p className="whitespace-pre-line">{displayContent}</p>
              }
            </div>
          ) : null}

          {/* Video embeds */}
          {videos.length > 0 && (
            <div className="mt-4">
              {videos.map((video, idx) => (
                <VideoEmbed key={`${video.url}-${idx}`} video={video} />
              ))}
            </div>
          )}

          {/* Source link */}
          {item.url && (
            <div className="mt-8 pt-4 border-t">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                查看原文 · {getSourceLabel(item.source)}
              </a>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

// --- Discover Feed Item Card (news-style) ---

function DiscoverFeedCard({
  item,
  categoriesMap,
  onShowSimilar,
  isLiked,
  isBookmarked,
  onLike,
  onBookmark,
  translatedTitle,
  translatedContent,
  onOpenDetail,
}: {
  item: AggregatedFeedItem;
  categoriesMap: Map<string, FeedCategory>;
  onShowSimilar?: (clusterId: string) => void;
  isLiked?: boolean;
  isBookmarked?: boolean;
  onLike?: (feedId: string, isLiked: boolean) => void;
  onBookmark?: (feedId: string, isBookmarked: boolean) => void;
  translatedTitle?: string | null;
  translatedContent?: string | null;
  onOpenDetail?: (item: AggregatedFeedItem) => void;
}) {
  const handleClick = () => {
    onOpenDetail?.(item);
  };

  const categoryLabel = getCategoryLabel(item.tags, categoriesMap);
  const hasImage = !!item.image_url;
  const scoreText = item.score >= 1000 ? `${(item.score / 1000).toFixed(1)}k` : String(item.score);
  const similarCount = (item.similar_count ?? 1) - 1;

  return (
    <div
      className="cursor-pointer group border-b border-border/50 last:border-b-0"
      onClick={handleClick}
    >
      <div className="px-4 py-3 transition-colors group-hover:bg-accent/30">
        <div className="flex gap-3">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Category + source + time */}
            <div className="flex items-center gap-1.5 mb-1">
              {categoryLabel && (
                <span className={cn(
                  "text-[11px] font-medium px-1.5 py-0.5 rounded",
                  getCategoryColor(item.tags, categoriesMap)
                )}>
                  {categoryLabel}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {getSourceLabel(item.source)}
              </span>
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <span className="text-[11px] text-muted-foreground">
                {formatRelativeTime(item.published_at)}
              </span>
            </div>

            {/* Title (use translated if available) */}
            {(translatedTitle || item.title) && (
              <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                {translatedTitle || item.title}
              </h3>
            )}

            {/* Content summary */}
            {(translatedContent || item.content) && !hasImage && (
              <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed mt-1">
                {stripHtml(translatedContent || item.content || "")}
              </p>
            )}

            {/* Bottom meta + interaction bar */}
            <div className="flex items-center gap-3 mt-1.5">
              {item.score > 0 && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                  <Flame className="h-3 w-3 text-orange-500/70" />
                  {scoreText}
                </span>
              )}
              {item.author_name && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                  {item.author_name}
                </span>
              )}
              {/* Similar articles badge */}
              {similarCount > 0 && item.cluster_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowSimilar?.(item.cluster_id!);
                  }}
                  className="text-[11px] text-primary/80 hover:text-primary font-medium flex items-center gap-0.5 transition-colors"
                >
                  {similarCount} 篇相似报道
                </button>
              )}

              {/* Spacer */}
              <span className="flex-1" />

              {/* Like button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLike?.(item.id, !!isLiked);
                }}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  isLiked ? "text-red-500" : "text-muted-foreground/50 hover:text-red-400"
                )}
                aria-label={isLiked ? "取消点赞" : "点赞"}
              >
                <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
              </button>

              {/* Bookmark button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBookmark?.(item.id, !!isBookmarked);
                }}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  isBookmarked ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-400"
                )}
                aria-label={isBookmarked ? "取消收藏" : "收藏"}
              >
                <Bookmark className={cn("h-3.5 w-3.5", isBookmarked && "fill-current")} />
              </button>
            </div>
          </div>

          {/* Thumbnail image */}
          {hasImage && (
            <div className="shrink-0 w-[88px] h-[66px] rounded-lg overflow-hidden bg-muted mt-1">
              <img
                src={item.image_url!}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Discover Feed Skeleton ---

function DiscoverFeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border/50">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-10 rounded" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-24" />
            </div>
            {i % 3 === 0 && <Skeleton className="w-[88px] h-[66px] rounded-lg shrink-0" />}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Similar Articles Sheet ---

function SimilarArticlesSheet({
  clusterId,
  open,
  onOpenChange,
}: {
  clusterId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: articles, isLoading } = useSimilarArticles(open ? clusterId : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">
            相似报道 {articles && articles.length > 0 ? `(${articles.length})` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-0 divide-y divide-border/50">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">加载中...</div>
          ) : !articles || articles.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">暂无相似报道</div>
          ) : (
            articles.map((item) => (
              <div
                key={item.id}
                className="py-3 cursor-pointer hover:bg-accent/30 transition-colors px-1 rounded"
                onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] text-muted-foreground">
                    {getSourceLabel(item.source)}
                  </span>
                  <span className="text-[11px] text-muted-foreground/50">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(item.published_at)}
                  </span>
                </div>
                <h4 className="text-sm font-medium leading-snug line-clamp-2">{item.title}</h4>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Discover Tab Content ---

function DiscoverTabContent() {
  const { i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [similarClusterId, setSimilarClusterId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<AggregatedFeedItem | null>(null);
  const sourceParam = filter === "all" ? undefined : filter;

  // Auto-open article from query param (e.g. from admin "站内查看")
  useEffect(() => {
    const articleId = searchParams.get("article");
    if (!articleId) return;
    // Clear param to avoid re-triggering
    setSearchParams({}, { replace: true });
    // Fetch article by ID and open detail panel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    sb.from("aggregated_feed")
      .select("*")
      .eq("id", articleId)
      .single()
      .then(({ data: article }: { data: AggregatedFeedItem | null }) => {
        if (article) setDetailItem(article);
      });
  }, [searchParams, setSearchParams]);

  // Use i18n language to filter news content (synced from profile.preferred_language)
  const contentLang = i18n.language?.startsWith("zh") ? "zh-CN" : i18n.language || "zh-CN";

  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAggregatedFeed(sourceParam, contentLang);
  const { data: categories } = useFeedCategories();

  // Flatten pages into single array
  const allItems = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  // Feed interactions
  const feedIds = useMemo(() => allItems.map((i) => i.id), [allItems]);
  const { data: itemStatus } = useFeedItemStatus(feedIds);
  const likeMutation = useFeedLike();
  const bookmarkMutation = useFeedBookmark();

  const handleLike = (feedId: string, isLiked: boolean) => {
    likeMutation.mutate({ feedId, isLiked });
  };
  const handleBookmark = (feedId: string, isBookmarked: boolean) => {
    bookmarkMutation.mutate({ feedId, isBookmarked });
  };

  // Translation — translate into user's language
  const { showTranslated, translating, translateItems, getTranslation, toggleTranslation } = useFeedTranslation(contentLang);

  // Auto-translate visible items when toggle is on
  useEffect(() => {
    if (showTranslated && feedIds.length > 0) {
      translateItems(feedIds.slice(0, 10));
    }
  }, [showTranslated, feedIds, translateItems]);

  // Build categories map for quick lookup
  const categoriesMap = useMemo(() => {
    const map = new Map<string, FeedCategory>();
    (categories || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Dynamic filter chips: "all" + first 8 categories
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; icon: React.ReactNode }[] = [
      { key: "all", label: "全部", icon: <Flame className="h-3.5 w-3.5" /> },
    ];
    (categories || []).slice(0, 8).forEach((cat) => {
      chips.push({
        key: cat.id,
        label: cat.label_zh,
        icon: getLucideIcon(cat.icon),
      });
    });
    return chips;
  }, [categories]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Source filter chips — scrollable */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background/80 backdrop-blur-sm overflow-x-auto scrollbar-hide">
        {filterChips.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs rounded-full transition-all whitespace-nowrap shrink-0",
              filter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
        {/* Translate toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 ml-auto shrink-0",
            showTranslated && "text-primary"
          )}
          onClick={toggleTranslation}
          title={showTranslated ? "显示原文" : "翻译为中文"}
        >
          <Languages className={cn("h-3.5 w-3.5", translating && "animate-pulse")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <DiscoverFeedSkeleton />
      ) : allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ExternalLink className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无发现内容</h3>
          <p className="text-sm text-muted-foreground mb-4">
            正在加载全球热点，请稍后再试
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            刷新
          </Button>
        </div>
      ) : (
        <div>
          {allItems.map((item) => {
            const t = showTranslated ? getTranslation(item.id) : undefined;
            return (
              <DiscoverFeedCard
                key={item.id}
                item={item}
                categoriesMap={categoriesMap}
                onShowSimilar={setSimilarClusterId}
                isLiked={itemStatus?.likedIds.has(item.id)}
                isBookmarked={itemStatus?.bookmarkedIds.has(item.id)}
                onLike={handleLike}
                onBookmark={handleBookmark}
                translatedTitle={t?.translated_title}
                translatedContent={t?.translated_content}
                onOpenDetail={setDetailItem}
              />
            );
          })}
          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center py-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {isFetchingNextPage ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Similar articles bottom sheet */}
      <SimilarArticlesSheet
        clusterId={similarClusterId}
        open={!!similarClusterId}
        onOpenChange={(open) => !open && setSimilarClusterId(null)}
      />

      {/* Article detail panel (full screen overlay) */}
      {detailItem && (
        <FeedDetailPanel
          item={detailItem}
          categoriesMap={categoriesMap}
          onClose={() => setDetailItem(null)}
          isLiked={itemStatus?.likedIds.has(detailItem.id)}
          isBookmarked={itemStatus?.bookmarkedIds.has(detailItem.id)}
          onLike={handleLike}
          onBookmark={handleBookmark}
          translatedTitle={showTranslated ? getTranslation(detailItem.id)?.translated_title : undefined}
          translatedContent={showTranslated ? getTranslation(detailItem.id)?.translated_content : undefined}
        />
      )}
    </div>
  );
}

// --- Main Feed Component ---

export default function Feed() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;
  const [activeTab, setActiveTab] = useState<FeedTab>("discover");
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  // 位置权限
  const { location, getCurrentLocation, permissionStatus } = useLocationPermission();

  // 当切换到附近 Tab 时请求位置
  useEffect(() => {
    if (activeTab === "nearby" && !location && permissionStatus !== "denied") {
      getCurrentLocation();
    }
  }, [activeTab, location, permissionStatus, getCurrentLocation]);

  // 各Tab的数据
  const recommendQuery = useRecommendFeed();
  const followingQuery = useFollowingFeed();
  const friendsQuery = useFriendsFeed();
  const nearbyQuery = useNearbyFeed(location || undefined);

  const likeMutation = usePostLike();
  const collectMutation = usePostCollection();
  const deleteMutation = useDeletePost();

  // 根据当前Tab获取对应数据（仅用于非 discover Tab）
  const getActiveQuery = () => {
    switch (activeTab) {
      case "recommend":
        return recommendQuery;
      case "following":
        return followingQuery;
      case "friends":
        return friendsQuery;
      case "nearby":
        return nearbyQuery;
      default:
        return recommendQuery;
    }
  };

  const activeQuery = getActiveQuery();
  const posts = activeTab !== "discover"
    ? activeQuery.data?.pages.flatMap((page) => page.posts) || []
    : [];

  const handleLike = (postId: string, isLiked: boolean) => {
    likeMutation.mutate({ postId, isLiked });
  };

  const handleCollect = (postId: string, isCollected: boolean) => {
    collectMutation.mutate({ postId, isCollected });
  };

  const handleDeleteClick = (postId: string) => {
    setDeletePostId(postId);
  };

  const handleDeleteConfirm = () => {
    if (!deletePostId) return;
    deleteMutation.mutate(deletePostId, {
      onSuccess: () => {
        toast({ title: "删除成功" });
        setDeletePostId(null);
      },
      onError: () => {
        toast({ variant: "destructive", title: "删除失败" });
      },
    });
  };

  const handleShare = (postId: string) => {
    setSharePostId(postId);
  };

  const handleRefresh = () => {
    activeQuery.refetch();
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="w-10" /> {/* 占位 */}

          {/* Tab 切换 */}
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {activeTab !== "discover" && (
              <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-9 w-9">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button asChild size="sm" className="h-8 gap-1.5 px-3">
              <Link to="/post/create">
                <PenSquare className="h-4 w-4" />
                <span>发帖</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Discover Tab content */}
      {activeTab === "discover" && (
        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col min-h-0">
          <DiscoverTabContent />
        </div>
      )}

      {/* Other tabs: UGC post list */}
      {activeTab !== "discover" && (
        <div className="max-w-2xl mx-auto flex-1 flex flex-col min-h-0">
          {/* 附近 Tab 位置提示 */}
          {activeTab === "nearby" && !location && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              {permissionStatus === "denied" ? (
                <>
                  <h3 className="text-lg font-medium mb-2">位置权限被拒绝</h3>
                  <p className="text-sm text-muted-foreground">
                    请在浏览器设置中允许位置访问，以查看附近的帖子
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium mb-2">正在获取位置...</h3>
                  <p className="text-sm text-muted-foreground">
                    请允许位置权限以查看附近的帖子
                  </p>
                </>
              )}
            </div>
          )}

          {/* 帖子列表 */}
          {(activeTab !== "nearby" || location) && (
            <div className="flex-1 min-h-0">
              <PostList
                posts={posts}
                currentUserId={userId}
                isLoading={activeQuery.isLoading}
                isFetchingNextPage={activeQuery.isFetchingNextPage}
                hasNextPage={activeQuery.hasNextPage}
                onLoadMore={() => activeQuery.fetchNextPage()}
                onRefresh={handleRefresh}
                onLike={handleLike}
                onCollect={handleCollect}
                onShare={handleShare}
                onDelete={handleDeleteClick}
              />
            </div>
          )}
        </div>
      )}

      {/* 转发对话框 */}
      <ShareDialog
        open={!!sharePostId}
        onOpenChange={(open) => !open && setSharePostId(null)}
        postId={sharePostId || ""}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={!!deletePostId}
        onOpenChange={(open) => !open && setDeletePostId(null)}
        title="删除帖子"
        description="确定要删除这条帖子吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
