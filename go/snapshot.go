package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	SNAPSHOTS_DIR_NAME = "__snapshots__"
)

// DiffFile represents a single file's change status in a diff
type DiffFile struct {
	File         string `json:"file"`
	Status       string `json:"status"`
	LinesChanged *int   `json:"lines_changed,omitempty"`
	Diff         string `json:"diff,omitempty"`
	Message      string `json:"message,omitempty"`
}

// DiffResult represents the entire comparison between snapshots
type DiffResult struct {
	Base    string     `json:"base"`
	Compare string     `json:"compare"`
	Files   []DiffFile `json:"files"`
}

// Helper function to ask user for input
func askUser(query string) (string, error) {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(query)
	answer, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(answer), nil
}

// Sanitize labels: lowercase, replace spaces, strip unsafe chars
func sanitizeLabel(label string) string {
	label = strings.ToLower(strings.TrimSpace(label))
	label = regexp.MustCompile(`\s+`).ReplaceAllString(label, "_")
	label = regexp.MustCompile(`[^a-z0-9._-]`).ReplaceAllString(label, "")
	return label
}

// Pad number with zeros
func padNumber(num int, width int) string {
	return fmt.Sprintf("%0*d", width, num)
}

// Get next snapshot index
func getNextSnapshotIndex(snapshotPath string) int {
	if _, err := os.Stat(snapshotPath); os.IsNotExist(err) {
		return 1
	}
	
	dirs, err := os.ReadDir(snapshotPath)
	if err != nil {
		return 1
	}
	
	max := 0
	re := regexp.MustCompile(`^(\d+)_`)
	for _, dir := range dirs {
		if dir.IsDir() {
			matches := re.FindStringSubmatch(dir.Name())
			if len(matches) > 1 {
				num, err := strconv.Atoi(matches[1])
				if err == nil && num > max {
					max = num
				}
			}
		}
	}
	return max + 1
}

// Find snapshot by index
func findSnapshotByIndex(snapshotsRoot string, targetIndex int) string {
	if _, err := os.Stat(snapshotsRoot); os.IsNotExist(err) {
		return ""
	}
	
	paddedIndex := padNumber(targetIndex, 4)
	dirs, err := os.ReadDir(snapshotsRoot)
	if err != nil {
		return ""
	}
	
	for _, dir := range dirs {
		if dir.IsDir() && strings.HasPrefix(dir.Name(), paddedIndex+"_") {
			return dir.Name()
		}
	}
	return ""
}

// Show comprehensive help
func showHelp() {
	fmt.Println("")
	fmt.Println("📸 jw-ai-snapshot - Lightweight AI-assisted development snapshotting tool")
	fmt.Println("")
	fmt.Println("USAGE:")
	fmt.Println("  ./snapshot_v2 init                       Initialize project configuration")
	fmt.Println("  ./snapshot_v2 \"description\"              Create a new snapshot")
	fmt.Println("  ./snapshot_v2 \"description\" --dev-mode   Create snapshot including tool files")
	fmt.Println("  ./snapshot_v2 NNNN --diff               Compare snapshot to current")
	fmt.Println("  ./snapshot_v2 NNNN MMMM --diff          Compare two snapshots")
	fmt.Println("  ./snapshot_v2 NNNN --prompt             Generate AI analysis prompt")
	fmt.Println("  ./snapshot_v2 NNNN --restore            Restore from snapshot")
	fmt.Println("  ./snapshot_v2 NNNN --restore --dry-run  Preview restore changes")
	fmt.Println("  ./snapshot_v2 NNNN --analyze-regression Advanced regression analysis")
	fmt.Println("  ./snapshot_v2 --help                    Show this help")
	fmt.Println("")
	fmt.Println("EXAMPLES:")
	fmt.Println("  ./snapshot_v2 init                       # First-time setup for new project")
	fmt.Println("  ./snapshot_v2 \"working login feature\"   # Create snapshot 0001_working_login_feature")
	fmt.Println("  ./snapshot_v2 23 --diff                 # Compare snapshot 23 to current state")
	fmt.Println("  ./snapshot_v2 20 25 --diff              # Compare snapshot 20 to snapshot 25")
	fmt.Println("  ./snapshot_v2 15 --prompt               # Generate AI prompt for changes since snapshot 15")
	fmt.Println("  ./snapshot_v2 18 --restore --dry-run    # Preview what restoring snapshot 18 would do")
	fmt.Println("  ./snapshot_v2 10 --analyze-regression   # Advanced analysis: find what broke after snapshot 10")
	fmt.Println("")
	fmt.Println("GETTING STARTED:")
	fmt.Println("  1. 🚀 Run \"./snapshot_v2 init\" in your project directory")
	fmt.Println("  2. 📸 Take snapshots frequently during development")
	fmt.Println("  3. 🔍 When something breaks, compare snapshots to identify changes")
	fmt.Println("  4. 🤖 Use --prompt or --analyze-regression to get AI-ready analysis")
	fmt.Println("  5. 🔧 Fix the issue using AI insights")
	fmt.Println("  6. ♻️  Use --restore if you need to rollback to a working state")
	fmt.Println("")
	fmt.Println("SNAPSHOT STORAGE:")
	fmt.Println("  Snapshots are stored in __snapshots__/ directory with format: NNNN_description/")
	fmt.Println("  Configure exclusions using .snapshotignore (two-section format)")
	fmt.Println("  • ALWAYS SNAPSHOT: Override .gitignore to include specific files")
	fmt.Println("  • NEVER SNAPSHOT: Add snapshot-specific exclusions")
	fmt.Println("")
	fmt.Println("AI FEATURES:")
	fmt.Println("  --prompt:             Generate single-comparison analysis (NNNN vs current)")
	fmt.Println("  --analyze-regression: Advanced two-part analysis (NNNN vs NNNN+1 vs current)")
	fmt.Println("                       Perfect for finding when and why something broke")
	fmt.Println("")
	fmt.Println("DEVELOPER OPTIONS:")
	fmt.Println("  --dev-mode:          Include tool source files (snapshot_v2.go, go.mod, etc.)")
	fmt.Println("                       Useful for taking snapshots of the tool itself during development")
	fmt.Println("")
}

// Initialize project with .snapshotignore and .gitignore setup
func initializeProject(projectRoot string) error {
	snapshotignorePath := filepath.Join(projectRoot, ".snapshotignore")
	
	// Check if already initialized
	if _, err := os.Stat(snapshotignorePath); err == nil {
		fmt.Println("")
		fmt.Println("⚠️  Project already initialized!")
		fmt.Println("   .snapshotignore file already exists.")
		fmt.Println("   To reconfigure, edit the .snapshotignore file directly.")
		fmt.Println("")
		return nil
	}
	
	fmt.Println("")
	fmt.Println("🚀 Welcome to jw-ai-snapshot!")
	fmt.Println("   Setting up your project configuration...")
	fmt.Println("")
	
	// Question: Add __snapshots__/ to .gitignore?
	fmt.Println("❓ Add the '__snapshots__/' directory to your .gitignore file?")
	fmt.Println("   (Recommended - prevents committing local snapshots to your repository)")
	
	var addToGitignore string
	for !contains([]string{"y", "n", "yes", "no"}, strings.ToLower(addToGitignore)) {
		answer, err := askUser("   Add __snapshots__/ to .gitignore? (Y/n): ")
		if err != nil {
			return err
		}
		if answer == "" {
			answer = "y" // Default to yes
		}
		addToGitignore = answer
		if !contains([]string{"y", "n", "yes", "no"}, strings.ToLower(addToGitignore)) {
			fmt.Println("   Please enter y, n, yes, or no.")
		}
	}
	shouldAddToGitignore := contains([]string{"y", "yes"}, strings.ToLower(addToGitignore))
	
	fmt.Println("")
	fmt.Println("📝 Creating configuration...")
	
	// Create .snapshotignore file with new two-section format
	configLines := []string{
		"# jw-ai-snapshot Configuration File",
		"# This file works WITH your .gitignore, not against it. The snapshot tool",
		"# will always use your .gitignore rules as a base. This file lets you",
		"# manage the exceptions.",
		"",
		"#-----------------------------------------------------------------------",
		"## ALWAYS SNAPSHOT (Exceptions to .gitignore)",
		"#-----------------------------------------------------------------------",
		"# Add files or folders here that you WANT to include in snapshots,",
		"# even if your .gitignore file ignores them.",
		"#",
		"# COMMON USE CASE: Your .gitignore probably ignores 'build/' or 'dist/'.",
		"# Add 'build/' here to make sure your snapshots contain those critical",
		"# build artifacts, creating a fully working copy.",
		"#",
		"# ANOTHER USE CASE: To snapshot environment files, add '.env' here.",
		"",
		"# build/",
		"# .env",
		"",
		"",
		"#-----------------------------------------------------------------------",
		"## NEVER SNAPSHOT (Snapshot-specific ignores)",
		"#-----------------------------------------------------------------------",
		"# Add files or folders here that should ONLY be ignored for snapshots.",
		"# This is useful for large assets or logs that you track in git but",
		"# don't need in every quick code snapshot.",
		"",
		"# --- Default Safe Ignores ---",
		"",
		"# Version Control",
		".git/",
		"",
		"# Dependencies",
		"node_modules/",
		"",
		"# OS & Editor specific",
		".DS_Store",
		".vscode/",
		".idea/",
		"",
		"# Logs",
		"*.log",
		"",
		"# Environment Files (un-comment the lines below to ignore them)",
		".env",
		".env.local",
		"",
	}
	
	err := os.WriteFile(snapshotignorePath, []byte(strings.Join(configLines, "\n")), 0644)
	if err != nil {
		return err
	}
	fmt.Println("✅ Created .snapshotignore with two-section configuration.")
	
	// Add to .gitignore if requested
	if shouldAddToGitignore {
		gitignorePath := filepath.Join(projectRoot, ".gitignore")
		gitignoreEntry := "__snapshots__/"
		
		if _, err := os.Stat(gitignorePath); err == nil {
			gitignoreContent, err := os.ReadFile(gitignorePath)
			if err != nil {
				return err
			}
			if !strings.Contains(string(gitignoreContent), gitignoreEntry) {
				newContent := string(gitignoreContent)
				if !strings.HasSuffix(newContent, "\n") {
					newContent += "\n"
				}
				newContent += "\n# jw-ai-snapshot: Ignore local snapshots directory\n" + gitignoreEntry + "\n"
				err = os.WriteFile(gitignorePath, []byte(newContent), 0644)
				if err != nil {
					return err
				}
				fmt.Println("✅ Added '__snapshots__/' to .gitignore.")
			} else {
				fmt.Println("ℹ️  '__snapshots__/' already exists in .gitignore.")
			}
		} else {
			newContent := "# jw-ai-snapshot: Ignore local snapshots directory\n" + gitignoreEntry + "\n"
			err = os.WriteFile(gitignorePath, []byte(newContent), 0644)
			if err != nil {
				return err
			}
			fmt.Println("✅ Created .gitignore and added '__snapshots__/'.")
		}
	}
	
	fmt.Println("")
	fmt.Println("🎉 Project initialized successfully!")
	fmt.Println("   The .snapshotignore file uses two sections:")
	fmt.Println("   • ALWAYS SNAPSHOT: Override .gitignore to include specific files")
	fmt.Println("   • NEVER SNAPSHOT: Add snapshot-specific exclusions")
	fmt.Println("")
	fmt.Println("   You can now create your first snapshot:")
	fmt.Println("   ./snapshot_v2 \"initial version\"")
	fmt.Println("")
	
	return nil
}

// Load ignore patterns from .gitignore and .snapshotignore with two-section parsing
func loadIgnoreList(projectRoot string, devMode bool) map[string]struct{} {
	ignoreSet := make(map[string]struct{})
	
	// Always start with .gitignore patterns as base
	gitignorePath := filepath.Join(projectRoot, ".gitignore")
	if !devMode {
		if content, err := os.ReadFile(gitignorePath); err == nil {
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
					ignoreSet[strings.TrimRight(trimmed, "/")] = struct{}{}
				}
			}
		}
	}
	
	// Read .snapshotignore file and parse the two sections
	snapshotignorePath := filepath.Join(projectRoot, ".snapshotignore")
	if content, err := os.ReadFile(snapshotignorePath); err == nil {
		lines := strings.Split(string(content), "\n")
		currentSection := ""
		var alwaysSnapshotPatterns []string
		var neverSnapshotPatterns []string
		
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			
			// Skip empty lines and comments (unless they're section headers)
			if trimmed == "" || (strings.HasPrefix(trimmed, "#") && !strings.HasPrefix(trimmed, "##")) {
				continue
			}
			
			// Check for section headers
			if trimmed == "## ALWAYS SNAPSHOT (Exceptions to .gitignore)" || strings.Contains(trimmed, "## ALWAYS SNAPSHOT") {
				currentSection = "always"
				continue
			}
			if trimmed == "## NEVER SNAPSHOT (Snapshot-specific ignores)" || strings.Contains(trimmed, "## NEVER SNAPSHOT") {
				currentSection = "never"
				continue
			}
			
			// Skip commented patterns
			if strings.HasPrefix(trimmed, "#") {
				continue
			}
			
			// Add patterns to appropriate section
			cleanPattern := strings.TrimRight(trimmed, "/")
			if currentSection == "always" {
				alwaysSnapshotPatterns = append(alwaysSnapshotPatterns, cleanPattern)
			} else if currentSection == "never" {
				neverSnapshotPatterns = append(neverSnapshotPatterns, cleanPattern)
			}
		}
		
		// Apply ALWAYS SNAPSHOT rules - remove from ignoreSet
		for _, pattern := range alwaysSnapshotPatterns {
			delete(ignoreSet, pattern)
			delete(ignoreSet, pattern+"/")
		}
		
		// Apply NEVER SNAPSHOT rules - add to ignoreSet
		for _, pattern := range neverSnapshotPatterns {
			// In dev mode, don't ignore tool's own files
			if devMode {
				toolFiles := []string{"snapshot_v2.go", ".snapshotignore", "go.mod", "go.sum"}
				if contains(toolFiles, pattern) {
					continue
				}
			}
			ignoreSet[pattern] = struct{}{}
		}
	}
	
	// Always ignore the snapshot directory itself
	ignoreSet[SNAPSHOTS_DIR_NAME] = struct{}{}
	return ignoreSet
}

// Check if a path should be ignored
func isIgnored(relPath string, ignoreSet map[string]struct{}) bool {
	normalized := filepath.ToSlash(relPath)
	for pattern := range ignoreSet {
		// Handle wildcard patterns
		if strings.Contains(pattern, "*") {
			matched, _ := filepath.Match(pattern, normalized)
			if matched {
				return true
			}
			// Also check if the pattern matches any part of the path
			pathParts := strings.Split(normalized, "/")
			for _, part := range pathParts {
				if matched, _ := filepath.Match(pattern, part); matched {
					return true
				}
			}
		} else if strings.HasSuffix(pattern, "/") {
			// Handle directory patterns like "dist/" or "node_modules/"
			if normalized == strings.TrimSuffix(pattern, "/") || strings.HasPrefix(normalized, pattern) {
				return true
			}
		} else {
			// Handle exact file/directory patterns
			if normalized == pattern || strings.HasPrefix(normalized, pattern+"/") {
				return true
			}
		}
	}
	return false
}

// List files recursively, respecting ignore patterns
func listFilesRecursively(dir, base string, ignoreSet map[string]struct{}) ([]string, error) {
	if base == "" {
		base = dir
	}
	
	var fileList []string
	
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}
		
		relPath, err := filepath.Rel(base, path)
		if err != nil {
			return nil
		}
		
		if relPath == "." {
			return nil
		}
		
		// Critical: Prevent recursion into the snapshots directory itself
		if filepath.Base(path) == SNAPSHOTS_DIR_NAME && filepath.Dir(path) == base {
			return filepath.SkipDir
		}
		
		if isIgnored(relPath, ignoreSet) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		
		if !info.IsDir() {
			fileList = append(fileList, relPath)
		}
		
		return nil
	})
	
	return fileList, err
}

// Hash file content
func hashFile(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	
	hasher := sha1.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// Simple unified diff implementation
func createUnifiedDiff(oldContent, newContent, filename string) string {
	oldLines := strings.Split(oldContent, "\n")
	newLines := strings.Split(newContent, "\n")
	
	var result []string
	result = append(result, fmt.Sprintf("--- %s", filename))
	result = append(result, fmt.Sprintf("+++ %s", filename))
	
	// Simple line-by-line comparison
	maxLines := len(oldLines)
	if len(newLines) > maxLines {
		maxLines = len(newLines)
	}
	
	contextStart := -1
	for i := 0; i < maxLines; i++ {
		oldLine := ""
		newLine := ""
		
		if i < len(oldLines) {
			oldLine = oldLines[i]
		}
		if i < len(newLines) {
			newLine = newLines[i]
		}
		
		if oldLine != newLine {
			if contextStart == -1 {
				contextStart = i
				result = append(result, fmt.Sprintf("@@ -%d,%d +%d,%d @@", i+1, len(oldLines)-i, i+1, len(newLines)-i))
			}
			
			if i < len(oldLines) {
				result = append(result, "-"+oldLine)
			}
			if i < len(newLines) {
				result = append(result, "+"+newLine)
			}
		} else if contextStart != -1 {
			result = append(result, " "+oldLine)
		}
	}
	
	return strings.Join(result, "\n")
}

// Compare snapshots with detailed diff output
func compareSnapshots(snapshotPath, currentPath string, ignoreSet map[string]struct{}) (*DiffResult, error) {
	result := &DiffResult{
		Base:    filepath.Base(snapshotPath),
		Compare: "current",
		Files:   []DiffFile{},
	}
	
	if filepath.Base(currentPath) != filepath.Base(os.Getenv("PWD")) && filepath.Base(currentPath) != "." {
		result.Compare = filepath.Base(currentPath)
	}
	
	snapshotFiles, err := listFilesRecursively(snapshotPath, snapshotPath, ignoreSet)
	if err != nil {
		return result, err
	}
	
	currentFiles, err := listFilesRecursively(currentPath, currentPath, ignoreSet)
	if err != nil {
		return result, err
	}
	
	// Create sets for faster lookup
	snapshotFileSet := make(map[string]struct{})
	for _, f := range snapshotFiles {
		snapshotFileSet[f] = struct{}{}
	}
	
	currentFileSet := make(map[string]struct{})
	for _, f := range currentFiles {
		currentFileSet[f] = struct{}{}
	}
	
	// Get all unique files
	allFilesMap := make(map[string]struct{})
	for _, f := range snapshotFiles {
		allFilesMap[f] = struct{}{}
	}
	for _, f := range currentFiles {
		allFilesMap[f] = struct{}{}
	}
	
	var allFiles []string
	for f := range allFilesMap {
		allFiles = append(allFiles, f)
	}
	sort.Strings(allFiles)
	
	for _, relPath := range allFiles {
		_, inSnap := snapshotFileSet[relPath]
		_, inCurr := currentFileSet[relPath]
		snapFile := filepath.Join(snapshotPath, relPath)
		currFile := filepath.Join(currentPath, relPath)
		
		if inSnap && !inCurr {
			result.Files = append(result.Files, DiffFile{
				File:   filepath.ToSlash(relPath),
				Status: "removed",
			})
		} else if !inSnap && inCurr {
			result.Files = append(result.Files, DiffFile{
				File:   filepath.ToSlash(relPath),
				Status: "added",
			})
		} else if inSnap && inCurr {
			snapHash, err1 := hashFile(snapFile)
			currHash, err2 := hashFile(currFile)
			if err1 != nil || err2 != nil {
				result.Files = append(result.Files, DiffFile{
					File:    filepath.ToSlash(relPath),
					Status:  "error_comparing",
					Message: "Could not read file for comparison",
				})
				continue
			}
			
			if snapHash != currHash {
				// Generate line-by-line diff for modified files
				snapContent, _ := os.ReadFile(snapFile)
				currContent, _ := os.ReadFile(currFile)
				diffResult := createUnifiedDiff(string(snapContent), string(currContent), relPath)
				
				snapLines := strings.Count(string(snapContent), "\n")
				currLines := strings.Count(string(currContent), "\n")
				delta := currLines - snapLines
				if delta < 0 {
					delta = -delta
				}
				
				result.Files = append(result.Files, DiffFile{
					File:         filepath.ToSlash(relPath),
					Status:       "modified",
					LinesChanged: &delta,
					Diff:         diffResult,
				})
			}
		}
	}
	
	return result, nil
}

// Append change manifest to snapshot.log
func appendChangeManifest(snapshotsRoot string, currentIndex int, label string, ignoreSet map[string]struct{}) error {
	logPath := filepath.Join(snapshotsRoot, "snapshot.log")
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	paddedIndex := padNumber(currentIndex, 4)
	
	var lines []string
	lines = append(lines, fmt.Sprintf("[%s] %s - \"%s\"", paddedIndex, timestamp, label))
	lines = append(lines, "")
	
	// Check if this is the first snapshot
	previousIndex := currentIndex - 1
	var previousFolder string
	
	if previousIndex > 0 {
		previousFolder = findSnapshotByIndex(snapshotsRoot, previousIndex)
	}
	
	if previousFolder == "" {
		// First snapshot - list all files as "Added"
		currentSnapshotPath := filepath.Join(snapshotsRoot, paddedIndex+"_"+sanitizeLabel(label))
		allFiles, err := listFilesRecursively(currentSnapshotPath, currentSnapshotPath, ignoreSet)
		if err != nil {
			return err
		}
		
		if len(allFiles) > 0 {
			lines = append(lines, "Initial snapshot")
			lines = append(lines, "")
			lines = append(lines, "Added:")
			
			if len(allFiles) <= 10 {
				for _, file := range allFiles {
					lines = append(lines, "  - "+file)
				}
			} else {
				for i := 0; i < 10; i++ {
					lines = append(lines, "  - "+allFiles[i])
				}
				lines = append(lines, fmt.Sprintf("  ...and %d more files", len(allFiles)-10))
			}
		}
	} else {
		// Compare with previous snapshot
		previousPath := filepath.Join(snapshotsRoot, previousFolder)
		currentSnapshotPath := filepath.Join(snapshotsRoot, paddedIndex+"_"+sanitizeLabel(label))
		
		diffData, err := compareSnapshots(previousPath, currentSnapshotPath, ignoreSet)
		if err != nil {
			return err
		}
		
		var modifiedFiles, addedFiles, removedFiles []string
		for _, f := range diffData.Files {
			switch f.Status {
			case "modified":
				modifiedFiles = append(modifiedFiles, f.File)
			case "added":
				addedFiles = append(addedFiles, f.File)
			case "removed":
				removedFiles = append(removedFiles, f.File)
			}
		}
		
		// Helper function to add file section with truncation
		addFileSection := func(sectionName string, files []string) {
			if len(files) > 0 {
				lines = append(lines, sectionName+":")
				if len(files) <= 10 {
					for _, file := range files {
						lines = append(lines, "  - "+file)
					}
				} else {
					for i := 0; i < 10; i++ {
						lines = append(lines, "  - "+files[i])
					}
					lines = append(lines, fmt.Sprintf("  ...and %d more %s files", len(files)-10, strings.ToLower(sectionName)))
				}
				lines = append(lines, "")
			}
		}
		
		addFileSection("Changed", modifiedFiles)
		addFileSection("Added", addedFiles)
		addFileSection("Removed", removedFiles)
	}
	
	lines = append(lines, "----------------------------------------")
	lines = append(lines, "")
	
	content := strings.Join(lines, "\n")
	
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	
	_, err = f.WriteString(content)
	return err
}

// Save AI-ready prompt
func savePrompt(diffData *DiffResult, index, snapshotName, snapshotDir string) error {
	var lines []string
	lines = append(lines, "# Code Analysis Request: Identify Breaking Changes")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("I have a working snapshot of my code located at `__snapshots__/%s_%s/` and my current code has a regression.", index, snapshotName))
	lines = append(lines, "Please analyze the changes below to help identify what may have broken the functionality.")
	lines = append(lines, "")
	lines = append(lines, "**Context:** The snapshot represents a known working state. The changes shown below represent")
	lines = append(lines, "all modifications made since that working version.")
	lines = append(lines, "")
	
	// Separate files by status
	var removedFiles, addedFiles, modifiedFiles []DiffFile
	for _, file := range diffData.Files {
		switch file.Status {
		case "removed":
			removedFiles = append(removedFiles, file)
		case "added":
			addedFiles = append(addedFiles, file)
		case "modified":
			modifiedFiles = append(modifiedFiles, file)
		}
	}
	
	// Add REMOVED files section
	if len(removedFiles) > 0 {
		lines = append(lines, "## [REMOVED] Files")
		lines = append(lines, "")
		lines = append(lines, "The following files were deleted from the current working directory (they exist in the snapshot):")
		lines = append(lines, "")
		for _, file := range removedFiles {
			lines = append(lines, fmt.Sprintf("- `%s` (was in snapshot, now deleted from current code)", file.File))
		}
		lines = append(lines, "")
	}
	
	// Add ADDED files section
	if len(addedFiles) > 0 {
		lines = append(lines, "## [ADDED] Files")
		lines = append(lines, "")
		lines = append(lines, "The following files were created in the current working directory (they do not exist in the snapshot):")
		lines = append(lines, "")
		for _, file := range addedFiles {
			lines = append(lines, fmt.Sprintf("- `%s` (new file, not in snapshot)", file.File))
		}
		lines = append(lines, "")
	}
	
	// Add MODIFIED files section with detailed diffs
	if len(modifiedFiles) > 0 {
		lines = append(lines, "## [MODIFIED] Files")
		lines = append(lines, "")
		lines = append(lines, "The following files were modified with line-by-line changes:")
		lines = append(lines, "")
		
		for _, file := range modifiedFiles {
			lines = append(lines, fmt.Sprintf("### `%s`", file.File))
			lines = append(lines, "")
			if file.LinesChanged != nil {
				lines = append(lines, fmt.Sprintf("**Lines changed:** %d", *file.LinesChanged))
			}
			lines = append(lines, "")
			
			if file.Diff != "" {
				// Parse and clean up the diff for better readability
				diffLines := strings.Split(file.Diff, "\n")
				var cleanDiff []string
				inContent := false
				
				for _, line := range diffLines {
					if strings.HasPrefix(line, "@@") {
						inContent = true
						cleanDiff = append(cleanDiff, line)
					} else if inContent && (strings.HasPrefix(line, "+") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, " ")) {
						cleanDiff = append(cleanDiff, line)
					}
				}
				
				lines = append(lines, "```diff")
				lines = append(lines, cleanDiff...)
				lines = append(lines, "```")
			}
			lines = append(lines, "")
		}
	}
	
	// Add closing instruction
	lines = append(lines, "---")
	lines = append(lines, "")
	lines = append(lines, "**Please analyze these changes and identify:**")
	lines = append(lines, "1. Which changes are most likely to have introduced a regression")
	lines = append(lines, "2. What functionality might be affected")
	lines = append(lines, "3. Specific areas to investigate or test")
	lines = append(lines, "")
	
	outputPath := filepath.Join(snapshotDir, fmt.Sprintf("prompt_%s_analysis.md", index))
	content := strings.Join(lines, "\n")
	err := os.WriteFile(outputPath, []byte(content), 0644)
	if err == nil {
		fmt.Printf("✅ AI-ready prompt saved to %s\n", outputPath)
	}
	return err
}

// Save regression analysis prompt with two-part analysis
func saveRegressionAnalysisPrompt(causalDiff, cumulativeDiff *DiffResult, baseIndex, baseName, nextIndex, nextName, snapshotDir string) error {
	var lines []string
	lines = append(lines, "# AI Regression Analysis: Advanced Two-Part Investigation")
	lines = append(lines, "")
	lines = append(lines, "I have identified a regression in my code and need your help with a comprehensive analysis.")
	lines = append(lines, "This prompt contains two parts that work together to identify the root cause and formulate a solution.")
	lines = append(lines, "")
	lines = append(lines, "**Context:**")
	lines = append(lines, fmt.Sprintf("- **Last Known Good:** `__snapshots__/%s_%s/` (working state)", baseIndex, baseName))
	lines = append(lines, fmt.Sprintf("- **First Breaking Version:** `__snapshots__/%s_%s/` (regression introduced)", nextIndex, nextName))
	lines = append(lines, "- **Current State:** Current working directory (may contain additional changes)")
	lines = append(lines, "")
	lines = append(lines, "---")
	lines = append(lines, "")
	
	// Helper function to format diff section
	formatDiffSection := func(diffData *DiffResult, title, subtitle string) []string {
		var sectionLines []string
		sectionLines = append(sectionLines, title)
		sectionLines = append(sectionLines, "")
		sectionLines = append(sectionLines, subtitle)
		sectionLines = append(sectionLines, "")
		
		var removedFiles, addedFiles, modifiedFiles []DiffFile
		for _, file := range diffData.Files {
			switch file.Status {
			case "removed":
				removedFiles = append(removedFiles, file)
			case "added":
				addedFiles = append(addedFiles, file)
			case "modified":
				modifiedFiles = append(modifiedFiles, file)
			}
		}
		
		if len(removedFiles) > 0 {
			sectionLines = append(sectionLines, "### [REMOVED] Files")
			sectionLines = append(sectionLines, "")
			for _, file := range removedFiles {
				sectionLines = append(sectionLines, fmt.Sprintf("- `%s`", file.File))
			}
			sectionLines = append(sectionLines, "")
		}
		
		if len(addedFiles) > 0 {
			sectionLines = append(sectionLines, "### [ADDED] Files")
			sectionLines = append(sectionLines, "")
			for _, file := range addedFiles {
				sectionLines = append(sectionLines, fmt.Sprintf("- `%s`", file.File))
			}
			sectionLines = append(sectionLines, "")
		}
		
		if len(modifiedFiles) > 0 {
			sectionLines = append(sectionLines, "### [MODIFIED] Files")
			sectionLines = append(sectionLines, "")
			for _, file := range modifiedFiles {
				sectionLines = append(sectionLines, fmt.Sprintf("#### `%s`", file.File))
				if file.LinesChanged != nil {
					sectionLines = append(sectionLines, fmt.Sprintf("**Lines changed:** %d", *file.LinesChanged))
				}
				sectionLines = append(sectionLines, "")
				
				if file.Diff != "" {
					diffLines := strings.Split(file.Diff, "\n")
					var cleanDiff []string
					inContent := false
					
					for _, line := range diffLines {
						if strings.HasPrefix(line, "@@") {
							inContent = true
							cleanDiff = append(cleanDiff, line)
						} else if inContent && (strings.HasPrefix(line, "+") || strings.HasPrefix(line, "-") || strings.HasPrefix(line, " ")) {
							cleanDiff = append(cleanDiff, line)
						}
					}
					
					sectionLines = append(sectionLines, "```diff")
					sectionLines = append(sectionLines, cleanDiff...)
					sectionLines = append(sectionLines, "```")
				}
				sectionLines = append(sectionLines, "")
			}
		}
		
		return sectionLines
	}
	
	// Section 1: The Immediate Breaking Change
	section1 := formatDiffSection(causalDiff, 
		"## SECTION 1: The Immediate Breaking Change",
		"**What changed between the last working version and the first broken version:**")
	lines = append(lines, section1...)
	
	lines = append(lines, "---")
	lines = append(lines, "")
	
	// Section 2: The Full Picture
	section2 := formatDiffSection(cumulativeDiff,
		"## SECTION 2: The Full Picture (All Changes Since Working Version)",
		"**What changed between the last working version and the current code:**")
	lines = append(lines, section2...)
	
	lines = append(lines, "---")
	lines = append(lines, "")
	lines = append(lines, "## YOUR TASK:")
	lines = append(lines, "")
	lines = append(lines, "**Step 1:** Analyze SECTION 1 to identify the most likely root cause of the regression.")
	lines = append(lines, "Focus on the specific changes that occurred between the working and broken states.")
	lines = append(lines, "")
	lines = append(lines, "**Step 2:** Using SECTION 2, formulate a solution that will work with the current codebase.")
	lines = append(lines, "Consider all the additional changes that have been made since the regression was introduced.")
	lines = append(lines, "")
	lines = append(lines, "**Please provide:**")
	lines = append(lines, "1. **Root Cause Analysis:** What specific change(s) in Section 1 likely caused the regression?")
	lines = append(lines, "2. **Impact Assessment:** What functionality is affected and why?")
	lines = append(lines, "3. **Solution Strategy:** How should this be fixed given the current state in Section 2?")
	lines = append(lines, "4. **Implementation Plan:** Specific code changes or investigation steps needed.")
	lines = append(lines, "")
	
	outputPath := filepath.Join(snapshotDir, fmt.Sprintf("regression_analysis_%s.md", baseIndex))
	content := strings.Join(lines, "\n")
	err := os.WriteFile(outputPath, []byte(content), 0644)
	if err == nil {
		fmt.Printf("✅ Advanced regression analysis prompt saved to %s\n", outputPath)
	}
	return err
}

// Restore snapshot with dry-run support
func restoreSnapshot(snapshotPath, currentPath string, ignoreSet map[string]struct{}, dryRun bool) error {
	snapshotFiles, err := listFilesRecursively(snapshotPath, snapshotPath, ignoreSet)
	if err != nil {
		return err
	}
	
	var restored, skipped int
	
	for _, relPath := range snapshotFiles {
		snapFile := filepath.Join(snapshotPath, relPath)
		destFile := filepath.Join(currentPath, relPath)
		
		snapHash, err1 := hashFile(snapFile)
		var destHash string
		if _, err := os.Stat(destFile); err == nil {
			destHash, _ = hashFile(destFile)
		}
		
		if err1 != nil || snapHash == destHash {
			skipped++
			continue
		}
		
		if dryRun {
			fmt.Printf("Would restore: %s\n", relPath)
		} else {
			err := os.MkdirAll(filepath.Dir(destFile), 0755)
			if err != nil {
				return err
			}
			
			src, err := os.Open(snapFile)
			if err != nil {
				return err
			}
			defer src.Close()
			
			dst, err := os.Create(destFile)
			if err != nil {
				return err
			}
			defer dst.Close()
			
			_, err = io.Copy(dst, src)
			if err != nil {
				return err
			}
			
			fmt.Printf("Restored: %s\n", relPath)
		}
		restored++
	}
	
	// Delete files not in snapshot
	currentFiles, err := listFilesRecursively(currentPath, currentPath, ignoreSet)
	if err != nil {
		return err
	}
	
	snapshotFileSet := make(map[string]struct{})
	for _, f := range snapshotFiles {
		snapshotFileSet[f] = struct{}{}
	}
	
	var deleted int
	for _, relPath := range currentFiles {
		if _, exists := snapshotFileSet[relPath]; !exists {
			fullPath := filepath.Join(currentPath, relPath)
			if dryRun {
				fmt.Printf("Would delete: %s\n", relPath)
			} else {
				if err := os.Remove(fullPath); err == nil {
					fmt.Printf("Deleted: %s\n", relPath)
				}
			}
			deleted++
		}
	}
	
	fmt.Println()
	if dryRun {
		fmt.Printf("🧪 Dry run complete. %d file(s) would be restored, %d skipped, %d would be deleted.\n", restored, skipped, deleted)
	} else {
		fmt.Printf("♻️ Restore complete. %d file(s) restored, %d skipped, %d deleted.\n", restored, skipped, deleted)
	}
	
	return nil
}

// Helper function to check if slice contains string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// Copy directory recursively
func copyDir(src, dest string, ignoreSet map[string]struct{}, baseSrc string) error {
	if baseSrc == "" {
		baseSrc = src
	}
	
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		relPath, err := filepath.Rel(baseSrc, srcPath)
		if err != nil {
			continue
		}
		
		// Explicitly skip the top-level __snapshots__ directory
		if filepath.Clean(srcPath) == filepath.Join(baseSrc, SNAPSHOTS_DIR_NAME) {
			continue
		}
		
		if isIgnored(relPath, ignoreSet) {
			continue
		}
		
		destPath := filepath.Join(dest, entry.Name())
		
		if entry.IsDir() {
			err := os.MkdirAll(destPath, 0755)
			if err != nil {
				return err
			}
			err = copyDir(srcPath, destPath, ignoreSet, baseSrc)
			if err != nil {
				return err
			}
		} else {
			err := os.MkdirAll(filepath.Dir(destPath), 0755)
			if err != nil {
				return err
			}
			
			src, err := os.Open(srcPath)
			if err != nil {
				return err
			}
			defer src.Close()
			
			dst, err := os.Create(destPath)
			if err != nil {
				return err
			}
			defer dst.Close()
			
			_, err = io.Copy(dst, src)
			if err != nil {
				return err
			}
		}
	}
	
	return nil
}

// Main CLI function
func main() {
	fmt.Println("")
	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to get current working directory: %v\n", err)
		os.Exit(1)
	}
	
	args := os.Args[1:]
	var hasHelp, hasDiff, hasPrompt, hasRestore, hasAnalyzeRegression, isDryRun, isDevMode bool
	var labelArgs []string
	
	for _, arg := range args {
		switch arg {
		case "--help", "-h":
			hasHelp = true
		case "--diff":
			hasDiff = true
		case "--prompt":
			hasPrompt = true
		case "--restore":
			hasRestore = true
		case "--analyze-regression":
			hasAnalyzeRegression = true
		case "--dry-run":
			isDryRun = true
		case "--dev-mode":
			isDevMode = true
		default:
			if !strings.HasPrefix(arg, "--") {
				labelArgs = append(labelArgs, arg)
			}
		}
	}
	
	// Handle init command
	if len(labelArgs) > 0 && labelArgs[0] == "init" {
		if err := initializeProject(projectRoot); err != nil {
			fmt.Fprintf(os.Stderr, "❌ Initialization failed: %v\n", err)
			os.Exit(1)
		}
		return
	}
	
	// Show help if requested or if no arguments provided
	if hasHelp || len(args) == 0 {
		showHelp()
		return
	}
	
	// Check if project is initialized (except for help and init commands)
	snapshotignorePath := filepath.Join(projectRoot, ".snapshotignore")
	if _, err := os.Stat(snapshotignorePath); os.IsNotExist(err) {
		fmt.Println("")
		fmt.Println("🚨 Welcome to jw-ai-snapshot!")
		fmt.Println("   It looks like this project hasn't been initialized.")
		fmt.Println("")
		fmt.Println("   Please run: ./snapshot_v2 init")
		fmt.Println("")
		os.Exit(1)
	}
	
	snapshotsRoot := filepath.Join(projectRoot, SNAPSHOTS_DIR_NAME)
	if err := os.MkdirAll(snapshotsRoot, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to create snapshots directory: %s. Please check permissions.\n", snapshotsRoot)
		os.Exit(1)
	}
	
	if (hasDiff || hasPrompt || hasRestore || hasAnalyzeRegression) && len(labelArgs) == 0 {
		fmt.Fprintf(os.Stderr, "❌ Please specify a snapshot index for --diff/--prompt/--restore/--analyze-regression\n")
		os.Exit(1)
	}
	
	// Load ignoreSet once here based on projectRoot
	mainIgnoreSet := loadIgnoreList(projectRoot, isDevMode)
	
	// Handle regression analysis first (separate logic)
	if hasAnalyzeRegression {
		baseIndex, err := strconv.Atoi(labelArgs[0])
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Invalid snapshot index: %s\n", labelArgs[0])
			os.Exit(1)
		}
		
		basePaddedIndex := padNumber(baseIndex, 4)
		baseFolder := findSnapshotByIndex(snapshotsRoot, baseIndex)
		
		if baseFolder == "" {
			fmt.Fprintf(os.Stderr, "❌ Base snapshot folder not found for index %d\n", baseIndex)
			os.Exit(1)
		}
		
		nextIndex := baseIndex + 1
		nextFolder := findSnapshotByIndex(snapshotsRoot, nextIndex)
		
		if nextFolder == "" {
			fmt.Fprintf(os.Stderr, "❌ No successor snapshot found. Snapshot %d appears to be the latest.\n", baseIndex)
			fmt.Fprintf(os.Stderr, "   Cannot analyze regression - need at least one snapshot after the known-good state.\n")
			os.Exit(1)
		}
		
		basePath := filepath.Join(snapshotsRoot, baseFolder)
		nextPath := filepath.Join(snapshotsRoot, nextFolder)
		nextPaddedIndex := padNumber(nextIndex, 4)
		
		fmt.Println("🔍 Starting regression analysis...")
		fmt.Printf("📂 Base (known good): %s\n", baseFolder)
		fmt.Printf("📁 Next (first broken): %s\n", nextFolder)
		fmt.Println("")
		
		// Generate Causal Diff (NNNN vs NNNN+1)
		fmt.Printf("⚡ Analyzing causal diff (%s → %s)...\n", basePaddedIndex, nextPaddedIndex)
		causalDiff, err := compareSnapshots(basePath, nextPath, mainIgnoreSet)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to generate causal diff: %v\n", err)
			os.Exit(1)
		}
		
		// Generate Cumulative Diff (NNNN vs current)
		fmt.Printf("🌐 Analyzing cumulative diff (%s → current)...\n", basePaddedIndex)
		cumulativeDiff, err := compareSnapshots(basePath, projectRoot, mainIgnoreSet)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to generate cumulative diff: %v\n", err)
			os.Exit(1)
		}
		
		// Save both diffs as JSON
		causalDiffPath := filepath.Join(snapshotsRoot, fmt.Sprintf("regression_causal_%s_to_%s.json", basePaddedIndex, nextPaddedIndex))
		cumulativeDiffPath := filepath.Join(snapshotsRoot, fmt.Sprintf("regression_cumulative_%s_to_current.json", basePaddedIndex))
		
		causalJSON, _ := json.MarshalIndent(causalDiff, "", "  ")
		cumulativeJSON, _ := json.MarshalIndent(cumulativeDiff, "", "  ")
		
		os.WriteFile(causalDiffPath, causalJSON, 0644)
		os.WriteFile(cumulativeDiffPath, cumulativeJSON, 0644)
		
		fmt.Printf("✅ Causal diff saved to %s\n", causalDiffPath)
		fmt.Printf("✅ Cumulative diff saved to %s\n", cumulativeDiffPath)
		
		// Generate the two-part regression analysis prompt
		baseName := strings.TrimPrefix(baseFolder, basePaddedIndex+"_")
		nextName := strings.TrimPrefix(nextFolder, nextPaddedIndex+"_")
		
		saveRegressionAnalysisPrompt(causalDiff, cumulativeDiff, basePaddedIndex, baseName, nextPaddedIndex, nextName, snapshotsRoot)
		
		fmt.Println("")
		fmt.Println("🎯 Regression analysis complete! Use the generated prompt with your LLM to identify the root cause and solution.")
		return
	}
	
	if hasDiff || hasPrompt || hasRestore {
		index1 := padNumber(mustAtoi(labelArgs[0]), 4)
		matchingFolder1 := findSnapshotByIndex(snapshotsRoot, mustAtoi(labelArgs[0]))
		if matchingFolder1 == "" {
			fmt.Fprintf(os.Stderr, "❌ Snapshot folder not found for index %s\n", index1)
			os.Exit(1)
		}
		snapshotPath1 := filepath.Join(snapshotsRoot, matchingFolder1)
		
		if hasRestore {
			restoreMsg := fmt.Sprintf("♻️ Restoring snapshot: %s", matchingFolder1)
			if isDryRun {
				restoreMsg += " (dry run)"
			}
			fmt.Println(restoreMsg)
			if err := restoreSnapshot(snapshotPath1, projectRoot, mainIgnoreSet, isDryRun); err != nil {
				fmt.Fprintf(os.Stderr, "❌ Restore failed: %v\n", err)
				os.Exit(1)
			}
			return
		}
		
		// Check for two-snapshot comparison
		var comparePath string
		var diffOutputPath string
		if len(labelArgs) >= 2 {
			// Two snapshot comparison: NNNN MMMM --diff
			index2 := padNumber(mustAtoi(labelArgs[1]), 4)
			matchingFolder2 := findSnapshotByIndex(snapshotsRoot, mustAtoi(labelArgs[1]))
			if matchingFolder2 == "" {
				fmt.Fprintf(os.Stderr, "❌ Snapshot folder not found for index %s\n", index2)
				os.Exit(1)
			}
			comparePath = filepath.Join(snapshotsRoot, matchingFolder2)
			diffOutputPath = filepath.Join(snapshotsRoot, fmt.Sprintf("diff_%s_to_%s.json", index1, index2))
			fmt.Printf("📂 Found snapshots: %s and %s\n", matchingFolder1, matchingFolder2)
			fmt.Printf("🔍 Comparing %s against %s...\n", matchingFolder1, matchingFolder2)
		} else {
			// Single snapshot comparison against current: NNNN --diff
			comparePath = projectRoot
			diffOutputPath = filepath.Join(snapshotsRoot, fmt.Sprintf("diff_%s_to_current.json", index1))
			fmt.Printf("📂 Found snapshot: %s\n", matchingFolder1)
			fmt.Println("🔍 Comparing against current working directory...")
		}
		
		diffData, err := compareSnapshots(snapshotPath1, comparePath, mainIgnoreSet)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Diff failed: %v\n", err)
			os.Exit(1)
		}
		
		jsonData, _ := json.MarshalIndent(diffData, "", "  ")
		os.WriteFile(diffOutputPath, jsonData, 0644)
		fmt.Printf("✅ Diff complete. Saved to %s\n", diffOutputPath)
		
		if hasPrompt {
			snapshotName := strings.TrimPrefix(matchingFolder1, index1+"_")
			savePrompt(diffData, index1, snapshotName, snapshotsRoot)
		}
		return
	}
	
	if len(labelArgs) == 0 {
		fmt.Fprintf(os.Stderr, "❌ Please provide a snapshot label or use --diff/--prompt/--restore with a snapshot index.\n")
		os.Exit(1)
	}
	
	labelRaw := strings.Join(labelArgs, " ")
	label := sanitizeLabel(labelRaw)
	nextIndex := getNextSnapshotIndex(snapshotsRoot)
	prefix := padNumber(nextIndex, 4)
	folderName := prefix + "_" + label
	snapshotDir := filepath.Join(snapshotsRoot, folderName)
	
	fmt.Printf("📸 Creating snapshot: %s\n", snapshotDir)
	
	err = os.MkdirAll(snapshotDir, 0755)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to create snapshot directory: %v\n", err)
		os.Exit(1)
	}
	
	err = copyDir(projectRoot, snapshotDir, mainIgnoreSet, projectRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to copy files: %v\n", err)
		os.Exit(1)
	}
	
	err = appendChangeManifest(snapshotsRoot, nextIndex, labelRaw, mainIgnoreSet)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to update change manifest: %v\n", err)
	}
	
	fmt.Println("✅ Snapshot complete.")
}

// Helper function for string to int conversion
func mustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Invalid number: %s\n", s)
		os.Exit(1)
	}
	return n
}