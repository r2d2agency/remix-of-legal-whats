import { useRef, useState, TouchEvent } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Undo2, Archive, Trash2 } from "lucide-react";

interface SwipeableConversationItemProps {
  children: React.ReactNode;
  onAccept?: () => void;
  onRelease?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  isWaiting?: boolean;
  isAttending?: boolean;
  isAdmin?: boolean;
  disabled?: boolean;
}

export function SwipeableConversationItem({
  children,
  onAccept,
  onRelease,
  onArchive,
  onDelete,
  isWaiting = false,
  isAttending = false,
  isAdmin = false,
  disabled = false,
}: SwipeableConversationItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const SWIPE_THRESHOLD = 80; // Minimum distance to trigger action
  const MAX_SWIPE = 100; // Maximum swipe distance

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping || disabled) return;
    
    const diff = e.touches[0].clientX - startX;
    const clampedDiff = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diff));
    
    setCurrentX(clampedDiff);
    setSwipeDirection(clampedDiff > 20 ? 'right' : clampedDiff < -20 ? 'left' : null);
  };

  const handleTouchEnd = () => {
    if (!isSwiping || disabled) return;

    // Trigger action based on swipe direction and threshold
    if (currentX > SWIPE_THRESHOLD) {
      // Swipe right - Accept (if waiting) or Release (if attending)
      if (isWaiting && onAccept) {
        onAccept();
      } else if (isAttending && onRelease) {
        onRelease();
      }
    } else if (currentX < -SWIPE_THRESHOLD) {
      // Swipe left - Archive or Delete (admin only)
      if (isAdmin && onDelete) {
        onDelete();
      } else if (onArchive) {
        onArchive();
      }
    }

    // Reset state
    setIsSwiping(false);
    setCurrentX(0);
    setSwipeDirection(null);
  };

  const showRightAction = isWaiting ? !!onAccept : isAttending ? !!onRelease : false;
  const showLeftAction = isAdmin ? !!onDelete : !!onArchive;

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* Background actions - Right swipe (Accept/Release) */}
      {showRightAction && (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity",
            isWaiting 
              ? "bg-green-500" 
              : "bg-amber-500",
            swipeDirection === 'right' && currentX > 40 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(currentX) }}
        >
          <div className="flex flex-col items-center text-white">
            {isWaiting ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">Aceitar</span>
              </>
            ) : (
              <>
                <Undo2 className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">Liberar</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Background actions - Left swipe (Archive/Delete) */}
      {showLeftAction && (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-opacity",
            isAdmin ? "bg-destructive" : "bg-muted",
            swipeDirection === 'left' && currentX < -40 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(currentX) }}
        >
          <div className={cn(
            "flex flex-col items-center",
            isAdmin ? "text-white" : "text-muted-foreground"
          )}>
            {isAdmin ? (
              <>
                <Trash2 className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">Excluir</span>
              </>
            ) : (
              <>
                <Archive className="h-5 w-5" />
                <span className="text-[10px] mt-0.5">Arquivar</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div
        className={cn(
          "relative bg-card transition-transform",
          isSwiping && "transition-none"
        )}
        style={{ transform: `translateX(${currentX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
