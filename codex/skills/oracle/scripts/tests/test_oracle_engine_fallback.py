
import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add scripts to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import oracle_engine

class TestOracleFallback(unittest.TestCase):
    
    @patch('oracle_engine.run_copilot')
    @patch('oracle_engine.run_codex')
    @patch('oracle_engine.run_gemini')
    @patch('oracle_engine.run_claude')
    def test_fallback_rate_limit(self, mock_claude, mock_gemini, mock_codex, mock_copilot):
        """
        Test that if Gemini fails with Rate Limit, it falls back to Copilot.
        """
        # Setup Mocks
        mock_gemini.side_effect = Exception("Error: 429 Rate Limit exceeded")
        mock_copilot.return_value = "Copilot Result"
        
        # Execute
        result = oracle_engine.execute_with_fallback(
            prompt="Test Prompt",
            primary_runner_name="Gemini",
            timeout=10
        )
        
        # Verify
        print(f"Result: {result}")
        self.assertEqual(result['runner'], 'Copilot')
        self.assertEqual(result['content'], 'Copilot Result')
        self.assertIsNone(result['error'])
        
        # Check calls
        mock_gemini.assert_called_once()
        mock_copilot.assert_called_once()
    
    @patch('oracle_engine.run_copilot')
    @patch('oracle_engine.run_codex')
    @patch('oracle_engine.run_gemini')
    @patch('oracle_engine.run_claude')
    def test_exhaustion(self, mock_claude, mock_gemini, mock_codex, mock_copilot):
        """
        Test that if all fail, it returns the last error.
        """
        mock_gemini.side_effect = Exception("Fail Gemini")
        mock_copilot.side_effect = Exception("Fail Copilot")
        mock_codex.side_effect = Exception("Fail Codex")
        mock_claude.side_effect = Exception("Fail Claude")
        
        result = oracle_engine.execute_with_fallback(
            prompt="Test Prompt",
            primary_runner_name="Gemini",
            timeout=10
        )
        
        print(f"Exhaustion Result: {result}")
        # It should try Gemini -> Copilot -> Codex -> Claude
        # Wait, the fallback order is fixed: Copilot, Codex, Gemini, Claude
        # But we start with Gemini.
        # So Gemini (Fail) -> Copilot (Fail) -> Codex (Fail) -> Claude (Fail) -> Stop
        
        # The recursion depth is max 3 retries (total 4 attempts).
        # Gemini (0) -> Copilot (1) -> Codex (2) -> Claude (3)
        
        self.assertIn("ERROR", result['content'])
        # The runner reported should be the *last* one attempted, or the primary?
        # The code returns: {"content": ..., "runner": primary_runner_name, "error": str(e)} 
        # But wait, in the recursion:
        # return execute_with_fallback(...) which returns a dict.
        # If the recursive call returns, it bubbles up.
        # If the recursive call hits max depth, it returns the error dict.
        
        # Let's see what the last one is.
        # If Claude fails at depth 3 (max retries 3?), wait.
        # execute_with_fallback: depth 0 (Gemini)
        # -> depth 1 (Copilot)
        # -> depth 2 (Codex)
        # -> depth 3 (Claude) -> fails. 
        # inside depth 3: depth (3) >= MAX_RETRIES (3). Returns Error dict.
        
        self.assertEqual(result['runner'], 'Claude') 

if __name__ == '__main__':
    unittest.main()
