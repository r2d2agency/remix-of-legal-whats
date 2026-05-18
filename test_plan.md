# Flow Limbo Debugging Plan
1. Ensure `wait_reply` node correctly follows `timeout` edge in `wait-reply-scheduler.js`.
2. Verify `continueFlowWithInput` correctly handles `wait_reply` node completion.
3. Check `flow_sessions` table for active sessions stuck in `wait_reply`.
