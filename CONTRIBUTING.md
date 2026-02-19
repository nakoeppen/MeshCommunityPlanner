# Contributing to Mesh Community Planner

Thank you for your interest in contributing! This document explains how to report bugs, request features, and submit code changes.

---

## Reporting Bugs

1. Search [existing issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include:
   - Operating system and version
   - Browser and version
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots if applicable

## Requesting Features

1. Search [existing issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues) to check if it has been suggested
2. Open a new issue using the **Feature Request** template
3. Describe the use case and why the feature would be valuable

## Security Vulnerabilities

Do **not** report security issues in public GitHub issues. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Development Setup

### Prerequisites

- Python 3.9+ with pip
- Node.js 18+ with npm
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### Running in Development

**Terminal 1 (Backend):**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

### Running Tests

```bash
# Backend tests
cd backend && python -m pytest tests/ -v

# Frontend tests
cd frontend && npm test
```

---

## Submitting Changes

1. **Fork** the repository
2. **Create a branch** from `main` with a descriptive name (e.g., `fix-csv-import-error` or `add-frequency-filter`)
3. **Make your changes** — keep commits focused and well-described
4. **Test your changes** — ensure existing tests pass and add tests for new functionality
5. **Open a Pull Request** against `main` with:
   - Clear description of what changed and why
   - Reference to any related issues
   - Screenshots for UI changes

### Code Style

- **Python:** Follow PEP 8. Use `ruff` for linting.
- **TypeScript:** Follow the existing ESLint configuration. Run `npm run lint`.
- **Commits:** Write clear, concise commit messages describing the change.

### What Makes a Good PR

- Solves one problem or adds one feature
- Includes tests for new or changed behavior
- Does not break existing functionality
- Has a clear description

---

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, constructive, and welcoming.

---

## License

By contributing, you agree that your contributions will be licensed under the same [CC BY-NC-SA 4.0](LICENSE) license as the project.
