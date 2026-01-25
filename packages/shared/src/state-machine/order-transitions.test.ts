import { describe, expect, it } from 'vitest';
import { OrderStatus } from '../enums';
import { assertTransition, canTransition, getAllowedTransitions } from './order-transitions';

describe('订单状态机', () => {
  describe('assertTransition', () => {
    it('应该允许合法的 Standby -> Executing 转换（新流程）', () => {
      expect(() => assertTransition(OrderStatus.Standby, OrderStatus.Executing)).not.toThrow();
    });

    it('应该允许合法的 Standby -> Pairing 转换（旧流程）', () => {
      expect(() => assertTransition(OrderStatus.Standby, OrderStatus.Pairing)).not.toThrow();
    });

    it('应该允许合法的 Executing -> Selecting 转换', () => {
      expect(() => assertTransition(OrderStatus.Executing, OrderStatus.Selecting)).not.toThrow();
    });

    it('应该允许合法的 Executing -> Standby 回滚（超时）', () => {
      expect(() => assertTransition(OrderStatus.Executing, OrderStatus.Standby)).not.toThrow();
    });

    it('应该允许合法的 Selecting -> InProgress 转换', () => {
      expect(() => assertTransition(OrderStatus.Selecting, OrderStatus.InProgress)).not.toThrow();
    });

    it('应该允许合法的 Selecting -> Standby 回滚（超时）', () => {
      expect(() => assertTransition(OrderStatus.Selecting, OrderStatus.Standby)).not.toThrow();
    });

    it('应该允许合法的 Pairing -> InProgress 转换', () => {
      expect(() => assertTransition(OrderStatus.Pairing, OrderStatus.InProgress)).not.toThrow();
    });

    it('应该允许合法的 Pairing -> Standby 回滚', () => {
      expect(() => assertTransition(OrderStatus.Pairing, OrderStatus.Standby)).not.toThrow();
    });

    it('应该允许合法的 InProgress -> Delivered 转换', () => {
      expect(() => assertTransition(OrderStatus.InProgress, OrderStatus.Delivered)).not.toThrow();
    });

    it('应该允许合法的 InProgress -> CancelRequested 转换', () => {
      expect(() =>
        assertTransition(OrderStatus.InProgress, OrderStatus.CancelRequested)
      ).not.toThrow();
    });

    it('应该允许合法的 Delivered -> Accepted 转换', () => {
      expect(() => assertTransition(OrderStatus.Delivered, OrderStatus.Accepted)).not.toThrow();
    });

    it('应该允许合法的 Delivered -> AutoAccepted 转换', () => {
      expect(() => assertTransition(OrderStatus.Delivered, OrderStatus.AutoAccepted)).not.toThrow();
    });

    it('应该允许合法的 Delivered -> RefundRequested 转换', () => {
      expect(() =>
        assertTransition(OrderStatus.Delivered, OrderStatus.RefundRequested)
      ).not.toThrow();
    });

    it('应该允许合法的 Accepted/AutoAccepted -> Paid 转换', () => {
      expect(() => assertTransition(OrderStatus.Accepted, OrderStatus.Paid)).not.toThrow();
      expect(() => assertTransition(OrderStatus.AutoAccepted, OrderStatus.Paid)).not.toThrow();
    });

    it('应该允许合法的 RefundRequested/CancelRequested -> Disputed 转换', () => {
      expect(() =>
        assertTransition(OrderStatus.RefundRequested, OrderStatus.Disputed)
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.CancelRequested, OrderStatus.Disputed)
      ).not.toThrow();
    });

    it('应该允许合法的 RefundRequested/CancelRequested -> Refunded 转换', () => {
      expect(() =>
        assertTransition(OrderStatus.RefundRequested, OrderStatus.Refunded)
      ).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.CancelRequested, OrderStatus.Refunded)
      ).not.toThrow();
    });

    it('应该允许合法的 Disputed -> AdminArbitrating 转换', () => {
      expect(() =>
        assertTransition(OrderStatus.Disputed, OrderStatus.AdminArbitrating)
      ).not.toThrow();
    });

    it('应该允许合法的 Disputed -> Delivered/InProgress 撤回', () => {
      expect(() => assertTransition(OrderStatus.Disputed, OrderStatus.Delivered)).not.toThrow();
      expect(() => assertTransition(OrderStatus.Disputed, OrderStatus.InProgress)).not.toThrow();
    });

    it('应该允许合法的 AdminArbitrating -> Paid/Refunded 转换', () => {
      expect(() => assertTransition(OrderStatus.AdminArbitrating, OrderStatus.Paid)).not.toThrow();
      expect(() =>
        assertTransition(OrderStatus.AdminArbitrating, OrderStatus.Refunded)
      ).not.toThrow();
    });

    it('应该允许合法的 Paid/Refunded -> Completed 转换', () => {
      expect(() => assertTransition(OrderStatus.Paid, OrderStatus.Completed)).not.toThrow();
      expect(() => assertTransition(OrderStatus.Refunded, OrderStatus.Completed)).not.toThrow();
    });

    it('应该拒绝非法的 Executing -> InProgress 跳跃', () => {
      expect(() => assertTransition(OrderStatus.Executing, OrderStatus.InProgress)).toThrow(
        'Invalid transition: Executing -> InProgress'
      );
    });

    it('应该拒绝非法的 Standby -> InProgress 跳跃', () => {
      expect(() => assertTransition(OrderStatus.Standby, OrderStatus.InProgress)).toThrow(
        'Invalid transition: Standby -> InProgress'
      );
    });

    it('应该拒绝非法的 Standby -> Completed 跳跃', () => {
      expect(() => assertTransition(OrderStatus.Standby, OrderStatus.Completed)).toThrow(
        'Invalid transition: Standby -> Completed'
      );
    });

    it('应该拒绝非法的 Delivered -> Paid 跳跃', () => {
      expect(() => assertTransition(OrderStatus.Delivered, OrderStatus.Paid)).toThrow(
        'Invalid transition: Delivered -> Paid'
      );
    });

    it('应该拒绝非法的 InProgress -> Paid 跳跃', () => {
      expect(() => assertTransition(OrderStatus.InProgress, OrderStatus.Paid)).toThrow(
        'Invalid transition: InProgress -> Paid'
      );
    });

    it('应该拒绝从 Completed 的任何转换', () => {
      expect(() => assertTransition(OrderStatus.Completed, OrderStatus.Standby)).toThrow(
        'Invalid transition: Completed -> Standby'
      );
      expect(() => assertTransition(OrderStatus.Completed, OrderStatus.Paid)).toThrow(
        'Invalid transition: Completed -> Paid'
      );
    });

    it('应该拒绝非法的回滚（InProgress -> Standby）', () => {
      expect(() => assertTransition(OrderStatus.InProgress, OrderStatus.Standby)).toThrow(
        'Invalid transition: InProgress -> Standby'
      );
    });

    it('应该拒绝非法的回滚（Delivered -> InProgress）', () => {
      expect(() => assertTransition(OrderStatus.Delivered, OrderStatus.InProgress)).toThrow(
        'Invalid transition: Delivered -> InProgress'
      );
    });
  });

  describe('canTransition', () => {
    it('应该对合法转换返回 true', () => {
      expect(canTransition(OrderStatus.Standby, OrderStatus.Executing)).toBe(true);
      expect(canTransition(OrderStatus.Standby, OrderStatus.Pairing)).toBe(true);
      expect(canTransition(OrderStatus.Executing, OrderStatus.Selecting)).toBe(true);
      expect(canTransition(OrderStatus.Executing, OrderStatus.Standby)).toBe(true);
      expect(canTransition(OrderStatus.Selecting, OrderStatus.InProgress)).toBe(true);
      expect(canTransition(OrderStatus.Selecting, OrderStatus.Standby)).toBe(true);
      expect(canTransition(OrderStatus.Pairing, OrderStatus.InProgress)).toBe(true);
      expect(canTransition(OrderStatus.InProgress, OrderStatus.Delivered)).toBe(true);
      expect(canTransition(OrderStatus.Disputed, OrderStatus.Delivered)).toBe(true);
      expect(canTransition(OrderStatus.Disputed, OrderStatus.InProgress)).toBe(true);
    });

    it('应该对非法转换返回 false', () => {
      expect(canTransition(OrderStatus.Standby, OrderStatus.Completed)).toBe(false);
      expect(canTransition(OrderStatus.Delivered, OrderStatus.Paid)).toBe(false);
      expect(canTransition(OrderStatus.Completed, OrderStatus.Standby)).toBe(false);
    });

    it('应该不抛出错误（与 assertTransition 不同）', () => {
      expect(() => canTransition(OrderStatus.Standby, OrderStatus.Completed)).not.toThrow();
      expect(canTransition(OrderStatus.Standby, OrderStatus.Completed)).toBe(false);
    });

    it('应该与 assertTransition 保持一致', () => {
      const testCases: [OrderStatus, OrderStatus, boolean][] = [
        [OrderStatus.Standby, OrderStatus.Executing, true],
        [OrderStatus.Standby, OrderStatus.Pairing, true],
        [OrderStatus.Standby, OrderStatus.Completed, false],
        [OrderStatus.Executing, OrderStatus.Selecting, true],
        [OrderStatus.Executing, OrderStatus.Standby, true],
        [OrderStatus.Executing, OrderStatus.InProgress, false],
        [OrderStatus.Selecting, OrderStatus.InProgress, true],
        [OrderStatus.Selecting, OrderStatus.Standby, true],
        [OrderStatus.Pairing, OrderStatus.InProgress, true],
        [OrderStatus.Pairing, OrderStatus.Standby, true],
        [OrderStatus.InProgress, OrderStatus.Standby, false],
        [OrderStatus.Delivered, OrderStatus.Paid, false],
        [OrderStatus.Delivered, OrderStatus.Accepted, true],
        [OrderStatus.Disputed, OrderStatus.Delivered, true],
        [OrderStatus.Disputed, OrderStatus.InProgress, true],
      ];

      for (const [from, to, expected] of testCases) {
        expect(canTransition(from, to)).toBe(expected);

        if (expected) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow();
        }
      }
    });
  });

  describe('getAllowedTransitions', () => {
    it('应该返回 Standby 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Standby);
      expect(allowed).toEqual([OrderStatus.Executing, OrderStatus.Pairing]);
    });

    it('应该返回 Executing 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Executing);
      expect(allowed).toEqual([OrderStatus.Selecting, OrderStatus.Standby]);
    });

    it('应该返回 Selecting 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Selecting);
      expect(allowed).toEqual([OrderStatus.InProgress, OrderStatus.Standby]);
    });

    it('应该返回 Pairing 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Pairing);
      expect(allowed).toEqual([OrderStatus.InProgress, OrderStatus.Standby]);
    });

    it('应该返回 InProgress 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.InProgress);
      expect(allowed).toEqual([OrderStatus.Delivered, OrderStatus.CancelRequested]);
    });

    it('应该返回 Delivered 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Delivered);
      expect(allowed).toEqual([
        OrderStatus.Accepted,
        OrderStatus.AutoAccepted,
        OrderStatus.RefundRequested,
      ]);
    });

    it('应该返回 Accepted 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Accepted);
      expect(allowed).toEqual([OrderStatus.Paid]);
    });

    it('应该返回 AutoAccepted 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.AutoAccepted);
      expect(allowed).toEqual([OrderStatus.Paid]);
    });

    it('应该返回 RefundRequested 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.RefundRequested);
      expect(allowed).toEqual([OrderStatus.Disputed, OrderStatus.Refunded]);
    });

    it('应该返回 CancelRequested 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.CancelRequested);
      expect(allowed).toEqual([OrderStatus.Disputed, OrderStatus.Refunded]);
    });

    it('应该返回 Disputed 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Disputed);
      expect(allowed).toEqual([
        OrderStatus.Delivered,
        OrderStatus.InProgress,
        OrderStatus.AdminArbitrating,
      ]);
    });

    it('应该返回 AdminArbitrating 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.AdminArbitrating);
      expect(allowed).toEqual([OrderStatus.Paid, OrderStatus.Refunded]);
    });

    it('应该返回 Paid 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Paid);
      expect(allowed).toEqual([OrderStatus.Completed]);
    });

    it('应该返回 Refunded 的允许转换', () => {
      const allowed = getAllowedTransitions(OrderStatus.Refunded);
      expect(allowed).toEqual([OrderStatus.Completed]);
    });

    it('应该返回 Completed 的空数组（终态）', () => {
      const allowed = getAllowedTransitions(OrderStatus.Completed);
      expect(allowed).toEqual([]);
    });

    it('返回的数组应该包含所有 canTransition 返回 true 的状态', () => {
      const allStatuses = Object.values(OrderStatus);

      for (const from of allStatuses) {
        const allowed = getAllowedTransitions(from);

        for (const to of allStatuses) {
          const isAllowed = allowed.includes(to);
          expect(canTransition(from, to)).toBe(isAllowed);
        }
      }
    });
  });

  describe('状态机完整性检查', () => {
    it('所有状态都应该有定义的转换规则', () => {
      const allStatuses = Object.values(OrderStatus);

      for (const status of allStatuses) {
        const allowed = getAllowedTransitions(status);
        expect(allowed).toBeDefined();
        expect(Array.isArray(allowed)).toBe(true);
      }
    });

    it('Completed 应该是唯一的终态', () => {
      const allStatuses = Object.values(OrderStatus);

      for (const status of allStatuses) {
        const allowed = getAllowedTransitions(status);

        if (status === OrderStatus.Completed) {
          expect(allowed).toHaveLength(0);
        } else {
          expect(allowed.length).toBeGreaterThan(0);
        }
      }
    });

    it('应该不存在自环（状态转换到自己）', () => {
      const allStatuses = Object.values(OrderStatus);

      for (const status of allStatuses) {
        const allowed = getAllowedTransitions(status);
        expect(allowed.includes(status)).toBe(false);
      }
    });

    it('RefundRequested 和 CancelRequested 应该有相同的允许转换', () => {
      const refundAllowed = getAllowedTransitions(OrderStatus.RefundRequested);
      const cancelAllowed = getAllowedTransitions(OrderStatus.CancelRequested);
      expect(refundAllowed).toEqual(cancelAllowed);
    });

    it('Accepted 和 AutoAccepted 应该有相同的允许转换', () => {
      const acceptedAllowed = getAllowedTransitions(OrderStatus.Accepted);
      const autoAcceptedAllowed = getAllowedTransitions(OrderStatus.AutoAccepted);
      expect(acceptedAllowed).toEqual(autoAcceptedAllowed);
    });

    it('Paid 和 Refunded 应该都只能转换到 Completed', () => {
      const paidAllowed = getAllowedTransitions(OrderStatus.Paid);
      const refundedAllowed = getAllowedTransitions(OrderStatus.Refunded);
      expect(paidAllowed).toEqual([OrderStatus.Completed]);
      expect(refundedAllowed).toEqual([OrderStatus.Completed]);
    });
  });

  describe('关键业务流程验证', () => {
    it('新流程：Standby -> Executing -> Selecting -> InProgress -> Delivered -> Accepted -> Paid -> Completed', () => {
      const newFlow = [
        OrderStatus.Standby,
        OrderStatus.Executing,
        OrderStatus.Selecting,
        OrderStatus.InProgress,
        OrderStatus.Delivered,
        OrderStatus.Accepted,
        OrderStatus.Paid,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < newFlow.length - 1; i++) {
        expect(() => assertTransition(newFlow[i], newFlow[i + 1])).not.toThrow();
      }
    });

    it('旧流程（兼容）：Standby -> Pairing -> InProgress -> Delivered -> Accepted -> Paid -> Completed', () => {
      const normalFlow = [
        OrderStatus.Standby,
        OrderStatus.Pairing,
        OrderStatus.InProgress,
        OrderStatus.Delivered,
        OrderStatus.Accepted,
        OrderStatus.Paid,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < normalFlow.length - 1; i++) {
        expect(() => assertTransition(normalFlow[i], normalFlow[i + 1])).not.toThrow();
      }
    });

    it('自动验收流程：Delivered -> AutoAccepted -> Paid -> Completed', () => {
      const autoAcceptFlow = [
        OrderStatus.Delivered,
        OrderStatus.AutoAccepted,
        OrderStatus.Paid,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < autoAcceptFlow.length - 1; i++) {
        expect(() => assertTransition(autoAcceptFlow[i], autoAcceptFlow[i + 1])).not.toThrow();
      }
    });

    it('退款流程：Delivered -> RefundRequested -> Refunded -> Completed', () => {
      const refundFlow = [
        OrderStatus.Delivered,
        OrderStatus.RefundRequested,
        OrderStatus.Refunded,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < refundFlow.length - 1; i++) {
        expect(() => assertTransition(refundFlow[i], refundFlow[i + 1])).not.toThrow();
      }
    });

    it('取消流程：InProgress -> CancelRequested -> Refunded -> Completed', () => {
      const cancelFlow = [
        OrderStatus.InProgress,
        OrderStatus.CancelRequested,
        OrderStatus.Refunded,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < cancelFlow.length - 1; i++) {
        expect(() => assertTransition(cancelFlow[i], cancelFlow[i + 1])).not.toThrow();
      }
    });

    it('争议流程：RefundRequested -> Disputed -> AdminArbitrating -> Paid/Refunded -> Completed', () => {
      const disputeFlow = [
        OrderStatus.RefundRequested,
        OrderStatus.Disputed,
        OrderStatus.AdminArbitrating,
        OrderStatus.Paid,
        OrderStatus.Completed,
      ];

      for (let i = 0; i < disputeFlow.length - 1; i++) {
        expect(() => assertTransition(disputeFlow[i], disputeFlow[i + 1])).not.toThrow();
      }
    });

    it('争议撤回（退款）：Delivered -> RefundRequested -> Disputed -> Delivered', () => {
      const withdrawalFlow = [
        OrderStatus.Delivered,
        OrderStatus.RefundRequested,
        OrderStatus.Disputed,
        OrderStatus.Delivered,
      ];

      for (let i = 0; i < withdrawalFlow.length - 1; i++) {
        expect(() => assertTransition(withdrawalFlow[i], withdrawalFlow[i + 1])).not.toThrow();
      }
    });

    it('争议撤回（中断）：InProgress -> CancelRequested -> Disputed -> InProgress', () => {
      const withdrawalFlow = [
        OrderStatus.InProgress,
        OrderStatus.CancelRequested,
        OrderStatus.Disputed,
        OrderStatus.InProgress,
      ];

      for (let i = 0; i < withdrawalFlow.length - 1; i++) {
        expect(() => assertTransition(withdrawalFlow[i], withdrawalFlow[i + 1])).not.toThrow();
      }
    });

    it('TTL 过期回滚：Pairing -> Standby', () => {
      expect(() => assertTransition(OrderStatus.Pairing, OrderStatus.Standby)).not.toThrow();
    });

    it('执行超时回滚：Executing -> Standby', () => {
      expect(() => assertTransition(OrderStatus.Executing, OrderStatus.Standby)).not.toThrow();
    });

    it('选择超时回滚：Selecting -> Standby', () => {
      expect(() => assertTransition(OrderStatus.Selecting, OrderStatus.Standby)).not.toThrow();
    });
  });
});
