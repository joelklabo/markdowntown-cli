import unittest
import threading
import time
import random
import sys
from io import StringIO
from scripts.oracle_common import UIManager

class TestUIManagerAdversary(unittest.TestCase):
    """
    Adversarial test cases for UIManager.
    Focuses on edge cases, race conditions, and invalid inputs.
    """

    def setUp(self):
        # Reset the singleton for each test if possible, 
        # though it's a singleton so state persists.
        # We can try to clear the spinner at least.
        self.ui = UIManager()
        self.ui.stop_spinner()
        
    def tearDown(self):
        self.ui.stop_spinner()

    def test_scenario_1_null_empty_inputs(self):
        """
        Scenario 1: Null/Empty inputs to render methods.
        Goal: Ensure it doesn't crash with None or empty strings.
        """
        print("\n--- Test Scenario 1: Null/Empty Inputs ---")
        
        # Test empty strings
        try:
            self.ui.log("")
            self.ui.start_spinner("")
            self.ui.update_spinner("")
        except Exception as e:
            self.fail(f"Crash on empty string: {e}")

        # Test None (expecting potential TypeErrors or safe handling)
        # The python type hint says str, but runtime might get None.
        try:
            self.ui.log(None)
        except Exception as e:
            print(f"Caught expected/unexpected error for log(None): {e}")

        try:
            self.ui.start_spinner(None)
        except Exception as e:
            print(f"Caught expected/unexpected error for start_spinner(None): {e}")
            
        try:
            self.ui.update_spinner(None)
        except Exception as e:
            print(f"Caught expected/unexpected error for update_spinner(None): {e}")

        # Cleanup
        self.ui.stop_spinner()

    def test_scenario_2_rapid_fire_calls(self):
        """
        Scenario 2: Rapid-fire method calls (state race conditions).
        Goal: Hammer the singleton from multiple threads to find race conditions/deadlocks.
        """
        print("\n--- Test Scenario 2: Rapid-Fire Race Conditions ---")
        
        def chaotic_actor(id):
            for _ in range(50):
                op = random.choice(['start', 'stop', 'update', 'log'])
                try:
                    if op == 'start':
                        self.ui.start_spinner(f"Spin {id}")
                    elif op == 'stop':
                        self.ui.stop_spinner()
                    elif op == 'update':
                        self.ui.update_spinner(f"Update {id}")
                    elif op == 'log':
                        self.ui.log(f"Log {id}")
                except Exception as e:
                    # We print but don't fail immediately to see if it recovers or crashes hard
                    print(f"Thread {id} error: {e}")
                time.sleep(0.001)

        threads = [threading.Thread(target=chaotic_actor, args=(i,)) for i in range(5)]
        
        start_time = time.time()
        for t in threads: t.start()
        for t in threads: t.join(timeout=2.0)
        
        if time.time() - start_time > 5.0:
            self.fail("Deadlock detected (timeout exceeded)!")

    def test_scenario_3_exception_handling_types(self):
        """
        Scenario 3: Exception handling / Type safety.
        Goal: Pass non-string objects to methods expecting strings.
        """
        print("\n--- Test Scenario 3: Bad Types ---")
        
        class NastyObject:
            def __str__(self):
                raise ValueError("I break when you look at me")
        
        # 1. Integer/Object instead of string
        try:
            self.ui.log(123)
            self.ui.log({"a": 1})
        except Exception as e:
            self.fail(f"Crash on non-string input: {e}")
            
        # 2. Object that raises on __str__
        # This tests if the logger eagerly converts to string inside a try/catch or just lets it blow up
        try:
            self.ui.log(NastyObject())
        except ValueError:
            print("Caught expected ValueError from NastyObject")
        except Exception as e:
            self.fail(f"Unexpected crash on NastyObject: {e}")

if __name__ == '__main__':
    unittest.main()
