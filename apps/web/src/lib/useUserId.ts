'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { apiFetch } from './api';

const USER_ID_KEY = 'c2c-user-id';
const USER_ADDRESS_KEY = 'c2c-user-address';
const USER_ROLES_KEY = 'c2c-user-roles'; // 存储已注册的角色列表

type ConnectWalletResponse = {
  userId: string;
};

export function useUserId(role: 'A' | 'B' = 'A') {
  const { address, isConnected } = useAccount();
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!isConnected || !address) {
      setUserId('');
      return;
    }

    const storedAddress = window.localStorage.getItem(USER_ADDRESS_KEY);
    const storedUserId = window.localStorage.getItem(USER_ID_KEY);
    const storedRoles = window.localStorage.getItem(USER_ROLES_KEY);
    const registeredRoles = storedRoles ? storedRoles.split(',') : [];

    // 只有当地址匹配、有 userId、且当前角色已注册时才跳过 API 调用
    if (
      storedAddress?.toLowerCase() === address.toLowerCase() &&
      storedUserId &&
      registeredRoles.includes(role)
    ) {
      setUserId(storedUserId);
      return;
    }

    setLoading(true);
    setError(null);

    apiFetch<ConnectWalletResponse>('/auth/wallet', {
      method: 'POST',
      body: JSON.stringify({ address, role }),
    })
      .then(({ userId }) => {
        setUserId(userId);
        window.localStorage.setItem(USER_ID_KEY, userId);
        window.localStorage.setItem(USER_ADDRESS_KEY, address);
        // 更新已注册角色列表
        const currentRoles =
          storedAddress?.toLowerCase() === address.toLowerCase() ? registeredRoles : [];
        if (!currentRoles.includes(role)) {
          currentRoles.push(role);
        }
        window.localStorage.setItem(USER_ROLES_KEY, currentRoles.join(','));
      })
      .catch((err) => {
        setUserId('');
        setError(err instanceof Error ? err.message : '连接钱包失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [address, hydrated, isConnected, role]);

  return { userId, isConnected, address, loading, error };
}
