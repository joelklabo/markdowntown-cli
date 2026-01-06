import unittest
import sys
import io
import os
from unittest.mock import patch, MagicMock
from scripts.oracle_common import UIManager

class TestUIManager(unittest.TestCase):
    def setUp(self):
        # Reset singleton instance to ensure clean state
        UIManager._instance = None
        self.ui = UIManager()
        # Disable spinners by default for log tests to keep output clean
        self.ui.spinner = None 

    def tearDown(self):
        if self.ui.spinner:
            self.ui.stop_spinner()
        UIManager._instance = None

    def test_singleton(self):
        """Test that UIManager follows the singleton pattern."""
        ui1 = UIManager()
        ui2 = UIManager()
        self.assertIs(ui1, ui2)

    @patch("sys.stdout", new_callable=io.StringIO)
    def test_log_info(self, mock_stdout):
        """Test basic info logging."""
        self.ui.log("test message", level="info")
        output = mock_stdout.getvalue()
        self.assertIn("oracle", output)
        self.assertIn("• test message", output)

    @patch("sys.stdout", new_callable=io.StringIO)
    def test_log_levels(self, mock_stdout):
        """Test different log levels."""
        self.ui.log("success msg", level="success")
        self.assertIn("✓ success msg", mock_stdout.getvalue())
        
        # Clear buffer
        mock_stdout.truncate(0)
        mock_stdout.seek(0)
        
        self.ui.log("error msg", level="error")
        self.assertIn("✗ error msg", mock_stdout.getvalue())

    @patch.dict(os.environ, {"ORACLE_VERBOSITY": "0"})
    def test_verbosity_zero(self):
        """Test that verbosity=0 suppresses output."""
        # Re-initialize to pick up env var
        UIManager._instance = None
        ui = UIManager()
        
        with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
            ui.log("should not appear")
            self.assertEqual(mock_stdout.getvalue(), "")

    def test_spinner_lifecycle(self):
        """Test start and stop of spinner (mocked threads)."""
        with patch("scripts.oracle_common.Spinner") as MockSpinner:
            spinner_instance = MockSpinner.return_value
            
            self.ui.start_spinner("Loading...")
            
            # Verify Spinner was created and started
            MockSpinner.assert_called_with("Loading...", self.ui.lock)
            spinner_instance.start.assert_called_once()
            
            self.ui.stop_spinner()
            
            # Verify stop was called
            spinner_instance.request_stop.assert_called()
            spinner_instance.wait_stopped.assert_called()

if __name__ == '__main__':
    unittest.main()
