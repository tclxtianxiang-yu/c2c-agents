/**
 * 修复 wallet_bindings 数据：让所有用户都支持双向角色（A 和 B）
 *
 * 运行方式: npx ts-node scripts/fix-dual-role-bindings.ts
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// ES module 兼容
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type WalletBinding = {
  id: string;
  user_id: string;
  role: 'A' | 'B';
  address: string;
  is_active: boolean;
};

async function main() {
  console.log('🔍 查询当前 wallet_bindings 数据...\n');

  // 获取所有活跃的 wallet_bindings
  const { data: bindings, error } = await supabase
    .from('wallet_bindings')
    .select('id, user_id, role, address, is_active')
    .eq('is_active', true);

  if (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }

  if (!bindings || bindings.length === 0) {
    console.log('没有找到任何 wallet_bindings 记录');
    return;
  }

  console.log(`找到 ${bindings.length} 条活跃的绑定记录\n`);

  // 按 user_id 分组
  const userBindings = new Map<string, WalletBinding[]>();
  for (const binding of bindings) {
    const existing = userBindings.get(binding.user_id) || [];
    existing.push(binding as WalletBinding);
    userBindings.set(binding.user_id, existing);
  }

  console.log(`共 ${userBindings.size} 个用户\n`);

  // 找出需要修复的用户
  const toFix: Array<{ userId: string; address: string; missingRole: 'A' | 'B' }> = [];

  for (const [userId, userBindingList] of userBindings) {
    const roles = userBindingList.map((b) => b.role);
    const hasA = roles.includes('A');
    const hasB = roles.includes('B');
    const address = userBindingList[0].address;

    console.log(`用户 ${userId.slice(0, 8)}... 角色: [${roles.join(', ')}]`);

    if (hasA && !hasB) {
      toFix.push({ userId, address, missingRole: 'B' });
      console.log(`  → 缺少角色 B`);
    } else if (hasB && !hasA) {
      toFix.push({ userId, address, missingRole: 'A' });
      console.log(`  → 缺少角色 A`);
    } else {
      console.log(`  ✓ 已有双向角色`);
    }
  }

  console.log(`\n需要修复 ${toFix.length} 个用户\n`);

  if (toFix.length === 0) {
    console.log('✅ 所有用户已支持双向角色，无需修复');
    return;
  }

  // 执行修复
  for (const fix of toFix) {
    console.log(`修复用户 ${fix.userId.slice(0, 8)}... 添加角色 ${fix.missingRole}`);

    const { error: insertError } = await supabase.from('wallet_bindings').insert({
      user_id: fix.userId,
      role: fix.missingRole,
      address: fix.address,
      is_active: true,
    });

    if (insertError) {
      console.error(`  ❌ 失败: ${insertError.message}`);
    } else {
      console.log(`  ✓ 成功`);
    }
  }

  console.log('\n✅ 修复完成！');
}

main().catch(console.error);
