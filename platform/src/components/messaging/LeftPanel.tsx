import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AllChatsTab } from "./AllChatsTab";
import { StrangersTab } from "./StrangersTab";
import { ContactsTab } from "./ContactsTab";
import { NotificationsTab } from "./NotificationsTab";
import { AddFriendDialog } from "./AddFriendDialog";
import { MessageSquare, UserX, Users, Bell, Search, MoreVertical, UserPlus } from "lucide-react";
import { useUnreadFriendRequests } from "@/hooks/useUnreadFriendRequests";

export function LeftPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const { hasUnread } = useUnreadFriendRequests();

  // 根据当前路由设置初始标签
  useEffect(() => {
    if (location.pathname.includes("/post/")) {
      setActiveTab("notifications");
    } else if (location.pathname.includes("/notifications")) {
      setActiveTab("notifications");
    }
  }, []);

  // 切换标签时导航到基础路由，让子组件触发自动选择
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // 切换标签时回到基础路由，让对应标签的组件自动选择第一项
    if (location.pathname !== "/conversations") {
      navigate("/conversations");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 搜索栏 */}
      <div className="flex items-center gap-2 p-3 border-b bg-black/40">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索聊天或用户..."
            className="pl-9 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAddFriendOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              添加好友
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-4 rounded-none border-b bg-black/90 backdrop-blur-md">
          <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:text-primary">
            全部
          </TabsTrigger>
          <TabsTrigger value="strangers" className="data-[state=active]:bg-transparent data-[state=active]:text-primary">
            陌生人
          </TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-transparent data-[state=active]:text-primary relative">
            通讯录
            {hasUnread && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-transparent data-[state=active]:text-primary">
            通知
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="all" className="h-full m-0">
            <AllChatsTab searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="strangers" className="h-full m-0">
            <StrangersTab searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="contacts" className="h-full m-0">
            <ContactsTab searchQuery={searchQuery} />
          </TabsContent>
          <TabsContent value="notifications" className="h-full m-0">
            <NotificationsTab searchQuery={searchQuery} />
          </TabsContent>
        </div>
      </Tabs>

      <AddFriendDialog open={addFriendOpen} onOpenChange={setAddFriendOpen} />
    </div>
  );
}
