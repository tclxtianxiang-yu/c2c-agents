-- 修复 wallet_bindings 数据：让所有用户都支持双向角色（A 和 B）
-- 对于只有单一角色绑定的用户，创建另一个角色的绑定（使用相同地址）

-- 1. 为只有 role='A' 的用户创建 role='B' 的绑定
INSERT INTO public.wallet_bindings (user_id, role, address, is_active, created_at)
SELECT
  wb.user_id,
  'B' as role,
  wb.address,
  true as is_active,
  now() as created_at
FROM public.wallet_bindings wb
WHERE wb.is_active = true
  AND wb.role = 'A'
  AND NOT EXISTS (
    SELECT 1 FROM public.wallet_bindings wb2
    WHERE wb2.user_id = wb.user_id
      AND wb2.role = 'B'
      AND wb2.is_active = true
  );

-- 2. 为只有 role='B' 的用户创建 role='A' 的绑定
INSERT INTO public.wallet_bindings (user_id, role, address, is_active, created_at)
SELECT
  wb.user_id,
  'A' as role,
  wb.address,
  true as is_active,
  now() as created_at
FROM public.wallet_bindings wb
WHERE wb.is_active = true
  AND wb.role = 'B'
  AND NOT EXISTS (
    SELECT 1 FROM public.wallet_bindings wb2
    WHERE wb2.user_id = wb.user_id
      AND wb2.role = 'A'
      AND wb2.is_active = true
  );

-- 验证：查看修复后每个用户的角色绑定情况
-- SELECT user_id, array_agg(role ORDER BY role) as roles, array_agg(address) as addresses
-- FROM public.wallet_bindings
-- WHERE is_active = true
-- GROUP BY user_id;
