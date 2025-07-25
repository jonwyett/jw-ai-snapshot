Excellent. This is a critical step. Creating a "Project Constitution" or a "Statement of Intent" ensures that the core philosophy is never lost, especially when working with an LLM that requires consistent context.

Here is the `PROJECT_OVERVIEW.md` document, crafted to serve as that exact context.

---

### **PROJECT_OVERVIEW.md**

# Project Overview: jw-ai-snapshot

## 1. Core Mission & Philosophy

**`jw-ai-snapshot` is a lightweight, local file-system snapshotting utility designed to accelerate and de-risk AI-assisted development.**

It is **not** a replacement for `git`. It is a high-velocity companion tool built for a specific workflow: the rapid, iterative cycle of coding with an LLM, where frequent, small changes can sometimes lead to unexpected regressions. While `git` is perfect for major checkpoints, it is too cumbersome for creating a "working-version" checkpoint every few minutes. This tool fills that gap, providing a frictionless way to save, compare, and restore states.

## 2. The "Why": The Developer's Narrative

A developer is using an LLM to rapidly add features to a project. At some point, they notice a piece of previously working functionality (e.g., a button on a popup) is now broken. The exact moment of the break is unknown, but they have been taking frequent snapshots.

The developer's goal is to **quickly find the breaking change**. They can do this by testing previous snapshots until they find the last one that worked. The critical next step, which this tool must facilitate, is to ask an LLM: *"What changed between this last working version and my currently broken code?"*

This tool's primary purpose is to answer that question with a precise, token-efficient, AI-ready prompt.

## 3. The Core Architectural Mandate: Go Parity

This project has a non-negotiable architectural constraint:

**The ultimate goal is a lightweight, standalone, cross-platform binary. Therefore, the Go implementation is the final deliverable.**

*   **Node.js as a Prototype:** The `snapshot.js` implementation serves as the feature-complete prototype. Its rich ecosystem (e.g., Jest for testing) makes it ideal for rapid development and validation of new ideas.
*   **Go as the Target:** The `go/snapshot.go` implementation is the production target. Every feature developed in Node.js must be translatable to Go.
*   **Dependency Constraint:** When adding any functionality or dependency to the Node.js version, we must **first confirm that a stable, functionally equivalent, and lightweight library exists in the Go ecosystem.** This prevents the Node.js version from evolving in a direction that cannot be replicated in Go. All core logic should rely on fundamental principles (file I/O, hashing, string manipulation, structured diffs) that are portable across both languages.

## 4. Current Development Focus: Building a Powerful Diff & Prompt Engine

The current development work is focused on evolving the tool from a simple file-lister into an intelligent diff engine. This work is captured in two epics:

*   **Epic 1: Implement Flexible, Granular Diffing:**
    *   **Goal:** To move beyond simple file hash checks and implement a true, line-by-line diffing capability.
    *   **Key Feature:** The engine must be flexible, allowing a user to compare any two snapshots (`NNNN` vs. `MMMM`) or a single snapshot against the current project state.

*   **Epic 2: Build an Intelligent AI Prompt Generator:**
    *   **Goal:** To create a prompt that is highly effective for LLM analysis.
    *   **Key Feature:** The prompt must be **token-efficient**. It will only show the line-by-line diffs for *modified* files, while simply listing the names of *added* or *removed* files. This focuses the LLM's attention on the most likely source of a regression.

This document should provide all the necessary context for the "why" and "how" of the project's development.