# CLAUDE.md

## Project documents
- DESIGN.md for high level design
- ARCHITECTURE.md for implementation architecture.

## General Guidelines

Prioritize:
- **Simplicity and readability** over defensive programming
- **Explicit failures** over graceful error handling
- **Straightforward implementations** over abstraction layers
- **Fast iteration** over bulletproof code

## Workflow

### Planning
- Ask clarifying questions using AskUserQuestionTool; interview the user thoroughly about requirements
- State assumptions explicitly
- Break unrelated features into independent incremental changes
- Write a plan with logical commit points
- Propose tests only for critical/tricky logic

### Post-processing
- Update README.md with concise info if relevant
- Commit at planned points


## Coding Style

### Simplicity First
- Make every change as simple as possible; impact minimal code
- No features beyond what was asked
- No abstractions for single-use code; prefer flat over nested
- No error handling for impossible scenarios
- If you write 200 lines and it could be 50, rewrite it

### Code Structure
- ~300 lines max per file; suggest breakdown when relevant
- Don't break up long functions unless it avoids duplication

### Comments
- One-liner docstrings by default
- Prefer block comments above sections over line-by-line

### Error Handling
- Prefer explicit crashes over defensive programming
- Assume input data is correct; let errors propagate naturally

## Python

- Use `uv` exclusively for package management: `uv run`, `uv add`, etc.
- Type hints for function signatures and class attributes
- Use `logging` module
- Avoid try/catch blocks unless absolutely necessary