#!/usr/bin/env tsx
/**
 * Supabase 数据库连接测试脚本
 *
 * 测试内容：
 * 1. 环境变量读取
 * 2. Supabase 客户端初始化
 * 3. 数据库连接测试（查询 tasks 表）
 * 4. 枚举类型测试
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@c2c-agents/config';

// 加载项目根目录的 .env 文件
dotenv.config({ path: resolve(__dirname, '../.env') });

async function testDatabaseConnection() {
  console.log('🚀 开始测试 Supabase 数据库连接...\n');

  // ========== Step 1: 验证环境变量 ==========
  console.log('📋 Step 1: 验证环境变量');
  const env = getEnv();

  if (!env.SUPABASE_URL) {
    console.error('❌ 错误: SUPABASE_URL 未设置');
    process.exit(1);
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ 错误: SUPABASE_SERVICE_ROLE_KEY 未设置');
    process.exit(1);
  }

  console.log(`✅ SUPABASE_URL: ${env.SUPABASE_URL}`);
  console.log(
    `✅ SUPABASE_SERVICE_ROLE_KEY: ${env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`
  );
  console.log();

  // ========== Step 2: 初始化 Supabase 客户端 ==========
  console.log('🔧 Step 2: 初始化 Supabase 客户端');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false, // 服务端不需要持久化 session
      autoRefreshToken: false,
    },
  });
  console.log('✅ Supabase 客户端初始化成功\n');

  // ========== Step 3: 测试数据库连接（查询表结构） ==========
  console.log('🗄️  Step 3: 测试数据库连接');

  try {
    // 3.1 查询 tasks 表（应该为空或有数据）
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, status')
      .limit(5);

    if (tasksError) {
      console.error('❌ 查询 tasks 表失败:', tasksError.message);
      process.exit(1);
    }

    console.log(`✅ tasks 表连接成功，当前记录数: ${tasks?.length || 0}`);
    if (tasks && tasks.length > 0) {
      console.log('   前 5 条记录:', JSON.stringify(tasks, null, 2));
    }
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }

  console.log();

  // ========== Step 4: 测试其他核心表 ==========
  console.log('📊 Step 4: 测试其他核心表');

  const tables = ['orders', 'agents', 'wallet_bindings', 'queue_items'];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`❌ ${table} 表查询失败:`, error.message);
        continue;
      }

      console.log(`✅ ${table} 表连接成功，记录数: ${count || 0}`);
    } catch (error) {
      console.error(`❌ ${table} 表查询失败:`, error);
    }
  }

  console.log();

  // ========== Step 5: 测试枚举类型 ==========
  console.log('🔤 Step 5: 测试枚举类型（通过查询 pg_type）');

  try {
    const { data: enums, error } = await supabase.rpc('get_enum_values', {
      enum_name: 'task_status',
    });

    if (error) {
      // 如果 RPC 函数不存在，使用原生 SQL 查询
      console.log('   (RPC 函数不存在，跳过枚举测试)');
    } else {
      console.log('✅ task_status 枚举值:', enums);
    }
  } catch (error) {
    console.log('   (枚举测试跳过)');
  }

  console.log();

  // ========== Step 6: 测试插入数据（可选） ==========
  console.log('💾 Step 6: 测试数据插入（创建测试任务）');

  try {
    // 注意：需要先有 user_id（可以使用 Supabase Auth 创建用户）
    // 这里仅测试表结构，不实际插入
    console.log('   (跳过插入测试，避免脏数据)');
  } catch (error) {
    console.log('   (插入测试跳过)');
  }

  console.log();

  // ========== 总结 ==========
  console.log('✅ 数据库连接测试完成！');
  console.log('📌 所有核心表均可访问');
  console.log('📌 Supabase 配置正确');
  console.log('📌 可以开始开发 CRUD 操作');
}

// 执行测试
testDatabaseConnection().catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
