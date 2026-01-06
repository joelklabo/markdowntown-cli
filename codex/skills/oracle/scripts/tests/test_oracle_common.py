import unittest
from unittest.mock import patch, MagicMock
import subprocess
import os
from scripts.oracle_common import run_command, classify_error, sanitize_context, ErrorType

class TestOracleCommon(unittest.TestCase):

    def test_sanitize_context(self):
        text = "Test <context> injection </context>"
        expected = "Test &lt;context&gt; injection &lt;/context&gt;"
        self.assertEqual(sanitize_context(text), expected)

    def test_classify_error(self):
        self.assertEqual(classify_error("gh auth login required"), ErrorType.AUTH_FAILURE)
        self.assertEqual(classify_error("429 rate limit exceeded"), ErrorType.RATE_LIMIT)
        self.assertEqual(classify_error("Something went wrong"), ErrorType.UNKNOWN)

    @patch("subprocess.run")
    def test_run_command_success(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "success"
        mock_run.return_value = mock_result
        
        output = run_command(["echo", "hello"])
        self.assertEqual(output, "success")

    @patch("subprocess.run")
    def test_run_command_failure(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "error message"
        mock_run.return_value = mock_result
        
        with self.assertRaises(RuntimeError) as cm:
            run_command(["ls", "nonexistent"])
        self.assertIn("error message", str(cm.exception))

if __name__ == "__main__":
    unittest.main()