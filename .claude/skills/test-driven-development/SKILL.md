# Test-Driven Development Skill

Source: https://github.com/obra/superpowers/tree/main/skills/test-driven-development

Use this skill when building any new feature or fixing any bug in superbad-hq.

**Core rule: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**

Writing tests after the fact proves nothing — they pass immediately and tell you nothing about correctness.

## The Red-Green-Refactor Cycle

### RED — Write a failing test
- Write the smallest possible test that demonstrates the desired behaviour
- Run it and confirm it fails — and fails for the right reason
- A test that fails for the wrong reason is not a valid test

### GREEN — Write minimal passing code
- Write only enough code to make the test pass
- Resist the urge to build more than the test requires
- Run all tests and confirm they pass

### REFACTOR — Clean up
- Improve the code while keeping all tests green
- Run tests after every change
- Refactoring without green tests is just guessing

## Non-negotiables

- Never write production code before its corresponding test
- If code exists without a test, delete it and start with the test
- Each test covers one behaviour with a clear, descriptive name
- Tests prove behaviour, not implementation details

## Common rationalisations to reject

- "I'll write tests afterward" — tests written after always pass; they prove nothing
- "It's too simple to test" — simple code breaks too
- "Manual testing is enough" — it isn't systematic and doesn't survive refactoring
- "I've already written the code" — delete it; start with the test

## Red flags — stop and reset if you see these

- Writing implementation before a failing test exists
- Tests that only verify internal implementation, not observable behaviour
- Multiple behaviours crammed into one test
- Tests with no clear failure message

## Checklist before marking any task complete

- [ ] Test was written before implementation
- [ ] Test was observed to fail before implementation
- [ ] Implementation is minimal — only what the test requires
- [ ] All existing tests still pass
- [ ] Test name clearly describes the behaviour being verified
