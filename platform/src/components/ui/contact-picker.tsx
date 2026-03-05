import { useState, useEffect, useCallback } from "react";
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
import { LoadingSpinner } from "./loading-spinner";
import { Search, Users, User } from "lucide-react";
import { toast } from "sonner";

export interface Contact {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: "friend" | "group";
  conversationId?: string;
}

interface ContactPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "single" | "multiple";
  types?: ("friend" | "group")[];
  onSelect: (selected: Contact[]) => void;
  title?: string;
  confirmText?: string;
  excludeIds?: string[];
}

export function ContactPicker({
  open,
  onOpenChange,
  mode = "multiple",
  types = ["friend", "group"],
  onSelect,
  title = "选择联系人",
  confirmText = "确定",
  excludeIds = [],
}: ContactPickerProps) {
  const { currentIdentity } = useIdentity();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [friends, setFriends] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadContacts = useCallback(async () => {
    if (!currentIdentity) return;

    setIsLoading(true);
    try {
      // 加载好友列表
      if (types.includes("friend")) {
        const { data: friendshipsData } = await supabase
          .from("friendships")
          .select("friend_id")
          .eq("user_id", currentIdentity.profile.id);

        if (friendshipsData && friendshipsData.length > 0) {
          const friendIds = friendshipsData.map((f) => f.friend_id);
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("id, display_name, unique_username, avatar_url")
            .in("id", friendIds);

          if (friendProfiles) {
            const friendContacts: Contact[] = friendProfiles
              .filter((p) => !excludeIds.includes(p.id))
              .map((profile) => ({
                id: profile.id,
                name: profile.display_name || profile.unique_username,
                avatarUrl: profile.avatar_url,
                type: "friend",
              }));
            setFriends(friendContacts);
          }
        }
      }

      // 加载群组列表
      if (types.includes("group")) {
        const { data: groupMembersData } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", currentIdentity.profile.id);

        if (groupMembersData && groupMembersData.length > 0) {
          const groupIds = groupMembersData.map((gm) => gm.group_id);
          const { data: groupsData } = await supabase
            .from("group_chats")
            .select("id, name, avatar_url, conversation_id")
            .in("id", groupIds);

          if (groupsData) {
            const groupContacts: Contact[] = groupsData
              .filter((g) => !excludeIds.includes(g.id))
              .map((group) => ({
                id: group.id,
                name: group.name,
                avatarUrl: group.avatar_url,
                type: "group",
                conversationId: group.conversation_id,
              }));
            setGroups(groupContacts);
          }
        }
      }
    } catch (error) {
      console.error("加载联系人失败:", error);
      toast.error("加载联系人列表失败");
    } finally {
      setIsLoading(false);
    }
  }, [currentIdentity, types, excludeIds]);

  useEffect(() => {
    if (open && currentIdentity) {
      loadContacts();
      setSelectedIds(new Set());
      setSearchQuery("");
    }
  }, [open, currentIdentity, loadContacts]);

  const toggleContact = (contactId: string) => {
    if (mode === "single") {
      setSelectedIds(new Set([contactId]));
    } else {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(contactId)) {
          newSet.delete(contactId);
        } else {
          newSet.add(contactId);
        }
        return newSet;
      });
    }
  };

  const handleConfirm = () => {
    const allContacts = [...friends, ...groups];
    const selected = allContacts.filter((c) => selectedIds.has(c.id));
    onSelect(selected);
    onOpenChange(false);
  };

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderContactList = (contacts: Contact[]) => (
    <div className="space-y-2">
      {contacts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchQuery ? "未找到匹配的结果" : "暂无数据"}
        </div>
      ) : (
        contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
            onClick={() => toggleContact(contact.id)}
          >
            <Checkbox
              checked={selectedIds.has(contact.id)}
              onCheckedChange={() => toggleContact(contact.id)}
              onClick={(e) => e.stopPropagation()}
            />

            <Avatar className="h-10 w-10">
              <AvatarImage src={contact.avatarUrl || ""} />
              <AvatarFallback>{contact.name[0]?.toUpperCase() || "?"}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{contact.name}</p>
              <p className="text-xs text-muted-foreground">
                {contact.type === "friend" ? "好友" : "群组"}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const showTabs = types.length > 1;
  const defaultTab = types.includes("friend") ? "friends" : "groups";

  return (
    <ContentDialog open={open} onOpenChange={onOpenChange} className="max-w-[500px]">
      <ContentDialogHeader onClose={() => onOpenChange(false)}>
        <ContentDialogTitle>{title}</ContentDialogTitle>
      </ContentDialogHeader>

      <ContentDialogBody className="space-y-4 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索联系人或群组..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : showTabs ? (
          <Tabs defaultValue={defaultTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              {types.includes("friend") && (
                <TabsTrigger value="friends" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  好友 ({filteredFriends.length})
                </TabsTrigger>
              )}
              {types.includes("group") && (
                <TabsTrigger value="groups" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  群组 ({filteredGroups.length})
                </TabsTrigger>
              )}
            </TabsList>

            {types.includes("friend") && (
              <TabsContent value="friends" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  {renderContactList(filteredFriends)}
                </ScrollArea>
              </TabsContent>
            )}

            {types.includes("group") && (
              <TabsContent value="groups" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-[300px] pr-4">
                  {renderContactList(filteredGroups)}
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            {renderContactList(types.includes("friend") ? filteredFriends : filteredGroups)}
          </ScrollArea>
        )}
      </ContentDialogBody>

      <ContentDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
          {confirmText} {selectedIds.size > 0 && `(${selectedIds.size})`}
        </Button>
      </ContentDialogFooter>
    </ContentDialog>
  );
}
