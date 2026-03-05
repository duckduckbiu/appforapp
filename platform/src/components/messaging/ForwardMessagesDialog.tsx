import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import {
  ContentDialog,
  ContentDialogHeader,
  ContentDialogTitle,
  ContentDialogBody,
  ContentDialogFooter,
} from "@/components/ui/content-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, Users, User } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { toast } from "sonner";

interface ForwardTarget {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: "friend" | "group";
  conversationId?: string;
}

interface ForwardMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageIds: string[];
  messages: Array<{
    id: string;
    content: string | null;
    message_type: string;
    metadata?: any;
  }>;
}

export function ForwardMessagesDialog({
  open,
  onOpenChange,
  messageIds,
  messages,
}: ForwardMessagesDialogProps) {
  const { currentIdentity } = useIdentity();
  const [isLoading, setIsLoading] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<ForwardTarget[]>([]);
  const [groups, setGroups] = useState<ForwardTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [forwardType, setForwardType] = useState<"individual" | "merged">("individual");
  
  // 判断是否为单条转发
  const isSingleForward = messageIds.length === 1;

  useEffect(() => {
    if (open && currentIdentity) {
      loadTargets();
    }
  }, [open, currentIdentity]);

  const loadTargets = async () => {
    if (!currentIdentity) return;
    
    setIsLoading(true);
    try {
      // 加载好友列表
      const { data: friendshipsData } = await supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", currentIdentity.profile.id);

      if (friendshipsData && friendshipsData.length > 0) {
        const friendIds = friendshipsData.map(f => f.friend_id);
        const { data: friendProfiles } = await supabase
          .from("profiles")
          .select("id, display_name, unique_username, avatar_url")
          .in("id", friendIds);

        if (friendProfiles) {
          const friendTargets: ForwardTarget[] = friendProfiles.map(profile => ({
            id: profile.id,
            name: profile.display_name || profile.unique_username,
            avatarUrl: profile.avatar_url,
            type: "friend",
          }));
          setFriends(friendTargets);
        }
      }

      // 加载群组列表
      const { data: groupMembersData } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", currentIdentity.profile.id);

      if (groupMembersData && groupMembersData.length > 0) {
        const groupIds = groupMembersData.map(gm => gm.group_id);
        const { data: groupsData } = await supabase
          .from("group_chats")
          .select("id, name, avatar_url, conversation_id")
          .in("id", groupIds);

        if (groupsData) {
          const groupTargets: ForwardTarget[] = groupsData.map(group => ({
            id: group.id,
            name: group.name,
            avatarUrl: group.avatar_url,
            type: "group",
            conversationId: group.conversation_id,
          }));
          setGroups(groupTargets);
        }
      }
    } catch (error) {
      console.error("加载转发目标失败:", error);
      toast.error("加载联系人列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTarget = (targetId: string) => {
    setSelectedTargets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(targetId)) {
        newSet.delete(targetId);
      } else {
        newSet.add(targetId);
      }
      return newSet;
    });
  };

  const handleForward = async () => {
    if (!currentIdentity || selectedTargets.size === 0) return;

    setIsForwarding(true);
    try {
      const allTargets = [...friends, ...groups];
      const targets = allTargets.filter(t => selectedTargets.has(t.id));

      for (const target of targets) {
        let conversationId = target.conversationId;

        // 如果是好友，需要获取或创建私聊会话
        if (target.type === "friend") {
          const { data: conversationData, error: rpcError } = await supabase.rpc(
            "create_private_conversation",
            { 
              friend_uuid: target.id,
              sender_uuid: currentIdentity.profile.id
            }
          );
          
          if (rpcError) {
            console.error("创建会话失败:", rpcError);
            toast.error(`无法为 ${target.name} 创建会话`);
            continue;
          }
          
          conversationId = conversationData;
        }

        if (!conversationId) continue;

        if (forwardType === "merged") {
          // 合并转发：创建一条特殊的合并消息
          // 清理消息数据，只保留必要字段
          const cleanedMessages = messages
            .filter(m => messageIds.includes(m.id))
            .map(m => ({
              id: m.id,
              content: m.content,
              message_type: m.message_type,
              sender_id: (m as any).sender_id,
              created_at: (m as any).created_at,
              // 只保留必要的 metadata 字段
              metadata: m.metadata ? {
                image_url: m.metadata.image_url,
                file_name: m.metadata.file_name,
                file_url: m.metadata.file_url,
                file_type: m.metadata.file_type,
              } : null,
            }));

          const forwardMessage = {
            conversation_id: conversationId,
            sender_id: currentIdentity.profile.id,
            message_type: "merged_forward",
            content: `[聊天记录]`,
            metadata: {
              is_forwarded: true,
              original_sender_id: currentIdentity.profile.id,
              merged_messages: cleanedMessages,
              message_count: messageIds.length,
            },
          };

          const { error: insertError } = await supabase
            .from("messages")
            .insert(forwardMessage);
          
          if (insertError) {
            console.error("插入合并消息失败:", insertError);
            toast.error(`转发到 ${target.name} 失败: ${insertError.message}`);
            continue;
          }
        } else {
          // 逐条转发：分别发送每条消息
          for (const message of messages.filter(m => messageIds.includes(m.id))) {
            const forwardMessage = {
              conversation_id: conversationId,
              sender_id: currentIdentity.profile.id,
              message_type: message.message_type,
              content: message.content,
              metadata: {
                ...message.metadata,
                is_forwarded: true,
                original_sender_id: message.metadata?.original_sender_id || currentIdentity.profile.id,
              },
            };

            const { error: insertError } = await supabase
              .from("messages")
              .insert(forwardMessage);
            
            if (insertError) {
              console.error("插入消息失败:", insertError);
              toast.error(`转发到 ${target.name} 失败: ${insertError.message}`);
              break;
            }
          }
        }
      }

      toast.success(`已${forwardType === "merged" ? "合并" : "逐条"}转发给 ${targets.length} 个联系人/群组`);
      onOpenChange(false);
      setSelectedTargets(new Set());
      setForwardType("individual");
    } catch (error) {
      console.error("转发失败:", error);
      toast.error("转发失败，请重试");
    } finally {
      setIsForwarding(false);
    }
  };

  const filteredFriends = friends.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTargetList = (targets: ForwardTarget[]) => (
    <div className="space-y-2">
      {targets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "未找到匹配的结果" : "暂无数据"}
        </div>
      ) : (
        targets.map(target => (
          <div
            key={target.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
            onClick={() => toggleTarget(target.id)}
          >
            <Checkbox
              checked={selectedTargets.has(target.id)}
              onCheckedChange={() => toggleTarget(target.id)}
              onClick={(e) => e.stopPropagation()}
            />
            
            <Avatar className="h-10 w-10">
              <AvatarImage src={target.avatarUrl || ""} />
              <AvatarFallback>
                {target.name[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{target.name}</p>
              <p className="text-xs text-muted-foreground">
                {target.type === "friend" ? "好友" : "群组"}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <ContentDialog open={open} onOpenChange={onOpenChange} className="max-w-[500px]">
      <ContentDialogHeader onClose={() => onOpenChange(false)}>
        <ContentDialogTitle>转发消息</ContentDialogTitle>
      </ContentDialogHeader>

      <ContentDialogBody className="space-y-4 p-6">{/* 内容开始 */}

        {/* 转发类型选择 - 仅批量转发时显示 */}
        {!isSingleForward && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">转发方式</Label>
            <RadioGroup
              value={forwardType}
              onValueChange={(value) => setForwardType(value as "individual" | "merged")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="font-normal cursor-pointer">
                  逐条转发
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="merged" id="merged" />
                <Label htmlFor="merged" className="font-normal cursor-pointer">
                  合并转发
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索联系人或群组..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="default" />
          </div>
        ) : (
          <Tabs defaultValue="friends" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                好友 ({filteredFriends.length})
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                群组 ({filteredGroups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="flex-1 min-h-0 mt-4">
              <ScrollArea className="h-[300px] pr-4">
                {renderTargetList(filteredFriends)}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="groups" className="flex-1 min-h-0 mt-4">
              <ScrollArea className="h-[300px] pr-4">
                {renderTargetList(filteredGroups)}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </ContentDialogBody>{/* 内容结束 */}

      <ContentDialogFooter>
        <Button
          variant="outline"
          onClick={() => {
            onOpenChange(false);
            setSelectedTargets(new Set());
          }}
          disabled={isForwarding}
        >
          取消
        </Button>
        <Button
          onClick={handleForward}
          disabled={selectedTargets.size === 0 || isForwarding}
        >
          {isForwarding ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              转发中...
            </>
          ) : (
            `转发 (${selectedTargets.size})`
          )}
        </Button>
      </ContentDialogFooter>
    </ContentDialog>
  );
}
