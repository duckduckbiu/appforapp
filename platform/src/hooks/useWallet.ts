import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "@/hooks/use-toast";

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  related_post_id: string | null;
  related_user_id: string | null;
  created_at: string;
}

// 获取或创建用户钱包
export function useWallet() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["wallet", userId],
    queryFn: async (): Promise<Wallet | null> => {
      if (!userId) return null;

      // 尝试获取钱包
      let { data: wallet, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      // 如果没有钱包，创建一个
      if (!wallet) {
        const { data: newWallet, error: createError } = await supabase
          .from("wallets")
          .insert({ user_id: userId })
          .select()
          .single();

        if (createError) throw createError;
        wallet = newWallet;
      }

      return wallet;
    },
    enabled: !!userId,
  });
}

// 获取交易记录
export function useTransactions(limit = 20) {
  const { data: wallet } = useWallet();

  return useQuery({
    queryKey: ["transactions", wallet?.id, limit],
    queryFn: async (): Promise<Transaction[]> => {
      if (!wallet) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!wallet?.id,
  });
}

// 投币支持
export function usePaidLike() {
  const queryClient = useQueryClient();
  const { data: wallet } = useWallet();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ postId, amount }: { postId: string; amount: number }) => {
      if (!wallet || !userId) throw new Error("钱包未初始化");
      if (wallet.balance < amount) throw new Error("硬币不足");

      // 1. 获取帖子作者信息
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .single();

      if (postError || !post) throw new Error("帖子不存在");

      // 2. 检查是否已有点赞记录
      const { data: existingLike } = await supabase
        .from("post_likes")
        .select("id, is_paid, amount")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingLike) {
        // 更新现有记录：累加投币金额
        const newAmount = (existingLike.amount || 0) + amount;
        const { error: likeError } = await supabase
          .from("post_likes")
          .update({ is_paid: true, amount: newAmount })
          .eq("id", existingLike.id);

        if (likeError) throw likeError;
      } else {
        // 创建新的点赞+投币记录
        const { error: likeError } = await supabase
          .from("post_likes")
          .insert({
            post_id: postId,
            user_id: userId,
            is_paid: true,
            amount: amount,
          });

        if (likeError) throw likeError;

        // 更新帖子点赞计数
        const { data: currentPost } = await supabase
          .from("posts")
          .select("likes_count")
          .eq("id", postId)
          .single();

        if (currentPost) {
          await supabase
            .from("posts")
            .update({ likes_count: currentPost.likes_count + 1 })
            .eq("id", postId);
        }
      }

      // 3. 扣除用户余额并记录交易
      const newBalance = wallet.balance - amount;
      const { error: walletError } = await supabase
        .from("wallets")
        .update({ 
          balance: newBalance,
          total_spent: wallet.total_spent + amount 
        })
        .eq("id", wallet.id);

      if (walletError) throw walletError;

      // 5. 记录支出交易
      const { error: txError } = await supabase
        .from("transactions")
        .insert({
          wallet_id: wallet.id,
          type: "tip_sent",
          amount: -amount,
          balance_after: newBalance,
          description: "投币支持",
          related_post_id: postId,
          related_user_id: post.author_id,
        });

      if (txError) throw txError;

      // 6. 给帖子作者增加收益（90% 分成）
      const authorEarning = Math.floor(amount * 0.9);
      const { data: authorWallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", post.author_id)
        .maybeSingle();

      if (authorWallet) {
        const authorNewBalance = authorWallet.balance + authorEarning;
        await supabase
          .from("wallets")
          .update({ 
            balance: authorNewBalance,
            total_earned: authorWallet.total_earned + authorEarning 
          })
          .eq("id", authorWallet.id);

        // 记录作者收入交易
        await supabase
          .from("transactions")
          .insert({
            wallet_id: authorWallet.id,
            type: "tip_received",
            amount: authorEarning,
            balance_after: authorNewBalance,
            description: "收到投币支持",
            related_post_id: postId,
            related_user_id: userId,
          });
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["unlock-status"] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "投币失败",
        description: error.message,
      });
    },
  });
}
