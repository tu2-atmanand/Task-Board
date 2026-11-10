#!/usr/bin/env python3
"""
Generate Markdown test files containing inline tasks for testing the Kanban lazy rendering.

Creates a `TestingTasks` folder at the repository root (one level above `scripts/`) and
writes files containing up to 5 inline tasks per file until the requested number of tasks
is generated.

Usage:
  - Run interactively: `python scripts/generate_testing_tasks.py` and enter the number when prompted.
  - Or supply count on the command line: `python scripts/generate_testing_tasks.py --count 123`

Each generated file is named `tasks_<index>.md` and contains a small header and up to 5
lines like `- [ ] Task N: Generated for testing lazy rendering`.

This script is safe to run multiple times; it will continue numbering files without
overwriting existing `tasks_*.md` files in the `TestingTasks` folder.
"""

import os
import argparse
import math
import re
from datetime import datetime

TASKS_PER_FILE = 5


def find_next_file_index(testing_dir: str, prefix: str = "tasks_") -> int:
    # Look for existing files named like tasks_<number>.md and pick next index
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)\.md$")
    max_index = 0
    try:
        for name in os.listdir(testing_dir):
            m = pattern.match(name)
            if m:
                idx = int(m.group(1))
                if idx > max_index:
                    max_index = idx
    except FileNotFoundError:
        return 1
    return max_index + 1


def make_testing_tasks(root_dir: str, total_tasks: int) -> tuple[int, int]:
    testing_dir = os.path.join(root_dir, "TestingTasks")
    os.makedirs(testing_dir, exist_ok=True)

    next_index = find_next_file_index(testing_dir)
    tasks_written = 0
    file_count = 0

    while tasks_written < total_tasks:
        file_count += 1
        filename = f"tasks_{next_index}.md"
        next_index += 1
        file_path = os.path.join(testing_dir, filename)

        with open(file_path, "w", encoding="utf-8") as fh:
            fh.write(f"# Test Tasks Batch {file_count} - generated {datetime.utcnow().isoformat()}Z\n\n")
            for i in range(TASKS_PER_FILE):
                if tasks_written >= total_tasks:
                    break
                tasks_written += 1
                fh.write(f"- [ ] Task {tasks_written}: Generated for testing lazy rendering\n")

    return tasks_written, file_count


def main():
    parser = argparse.ArgumentParser(description="Generate test markdown files with inline tasks.")
    parser.add_argument("--count", "-c", type=int, default=None, help="Total number of tasks to generate")
    args = parser.parse_args()

    if args.count is None:
        try:
            raw = input("How many tasks would you like to generate? ")
            total = int(raw.strip())
        except Exception:
            print("Invalid number. Please run again and enter a positive integer.")
            return
    else:
        total = args.count

    if total <= 0:
        print("Please provide a positive integer greater than zero.")
        return

    # Determine repo root: parent of scripts folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, os.pardir))

    tasks_written, file_count = make_testing_tasks(repo_root, total)

    print(f"Generated {tasks_written} tasks across {file_count} files in '{os.path.join(repo_root, 'TestingTasks')}'")
    print("Done.")


if __name__ == '__main__':
    main()
