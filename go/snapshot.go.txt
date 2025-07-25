package main

import (
	"bufio"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	snapshotsDirName         = "__snapshots__"
	snapshotignoreFileName   = ".snapshotignore"
	gitignoreFileName        = ".gitignore"
	snapshotLogFileName      = "snapshot.log"
	addToGitignoreFlagKey    = "# ADD_TO_GITIGNORE="
	useGitignoreFlagKey      = "# USE_GITIGNORE="
)

// SnapshotConfig holds the configuration loaded from .snapshotignore
type SnapshotConfig struct {
	ManageGitignoreEntry    bool
	UseGitignorePatterns    *bool // Use a pointer to distinguish between false and not-set
	ManageGitignoreEntryIsSet bool
	UseGitignorePatternsIsSet bool
}

// DiffFile represents a single file's change status in a diff.
type DiffFile struct {
	File         string `json:"file"`
	Status       string `json:"status"`
	LinesChanged *int   `json:"lines_changed,omitempty"` // Pointer for optional field
	Message      string `json:"message,omitempty"`
}

// DiffResult represents the entire comparison between a snapshot and the current state.
type DiffResult struct {
	Base    string     `json:"base"`
	Compare string     `json:"compare"`
	Files   []DiffFile `json:"files"`
}

// --- Helper Functions ---

// askUser prompts the user with a query and returns their trimmed input.
func askUser(query string) (string, error) {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(query)
	answer, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(answer), nil
}

// sanitizeLabel cleans a string to be used as a valid directory name.
func sanitizeLabel(label string) string {
	label = strings.ToLower(strings.TrimSpace(label))
	label = regexp.MustCompile(`\s+`).ReplaceAllString(label, "_")
	label = regexp.MustCompile(`[^a-z0-9._-]`).ReplaceAllString(label, "")
	return label
}

// getNextSnapshotIndex finds the next available sequential index for a new snapshot.
func getNextSnapshotIndex(snapshotPath string) (int, error) {
	if _, err := os.Stat(snapshotPath); os.IsNotExist(err) {
		return 1, nil
	}

	dirs, err := os.ReadDir(snapshotPath)
	if err != nil {
		return 0, err
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
	return max + 1, nil
}

// getSnapshotignoreConfig reads and parses configuration flags from .snapshotignore.
func getSnapshotignoreConfig(projectRoot string) (SnapshotConfig, error) {
	snapshotignorePath := filepath.Join(projectRoot, snapshotignoreFileName)
	config := SnapshotConfig{
		ManageGitignoreEntry: true, // Default to true
		UseGitignorePatterns: nil,
	}

	file, err := os.Open(snapshotignorePath)
	if os.IsNotExist(err) {
		return config, nil // File doesn't exist, return defaults
	}
	if err != nil {
		return config, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, addToGitignoreFlagKey) {
			valStr := strings.ToUpper(strings.TrimPrefix(line, addToGitignoreFlagKey))
			config.ManageGitignoreEntry = (valStr == "TRUE")
			config.ManageGitignoreEntryIsSet = true
		} else if strings.HasPrefix(line, useGitignoreFlagKey) {
			valStr := strings.ToUpper(strings.TrimPrefix(line, useGitignoreFlagKey))
			usePatterns := (valStr == "TRUE")
			config.UseGitignorePatterns = &usePatterns
			config.UseGitignorePatternsIsSet = true
		}
	}
	return config, scanner.Err()
}

// setSnapshotignoreConfig writes configuration flags back to .snapshotignore.
func setSnapshotignoreConfig(projectRoot string, config SnapshotConfig) error {
	snapshotignorePath := filepath.Join(projectRoot, snapshotignoreFileName)

	manageEntryVal := "FALSE"
	if config.ManageGitignoreEntry {
		manageEntryVal = "TRUE"
	}
	manageEntryFlagContent := addToGitignoreFlagKey + manageEntryVal

	usePatternsVal := "FALSE"
	if config.UseGitignorePatterns != nil && *config.UseGitignorePatterns {
		usePatternsVal = "TRUE"
	}
	usePatternsFlagContent := useGitignoreFlagKey + usePatternsVal

	content, err := os.ReadFile(snapshotignorePath)
	if os.IsNotExist(err) {
		content = []byte{}
	} else if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	var newLines []string
	manageFlagFound, useFlagFound := false, false

	for _, line := range lines {
		if strings.HasPrefix(line, addToGitignoreFlagKey) {
			newLines = append(newLines, manageEntryFlagContent)
			manageFlagFound = true
		} else if strings.HasPrefix(line, useGitignoreFlagKey) {
			newLines = append(newLines, usePatternsFlagContent)
			useFlagFound = true
		} else {
			newLines = append(newLines, line)
		}
	}

	if !manageFlagFound {
		newLines = append([]string{manageEntryFlagContent}, newLines...)
	}
	if !useFlagFound {
		finalLines := []string{}
		inserted := false
		for i, line := range newLines {
			finalLines = append(finalLines, line)
			if strings.HasPrefix(line, addToGitignoreFlagKey) && !inserted {
				finalLines = append(finalLines, usePatternsFlagContent)
				if i+1 < len(newLines) && strings.TrimSpace(newLines[i+1]) != "" {
					finalLines = append(finalLines, "") // Add a blank line for separation
				}
				inserted = true
			}
		}
		if !inserted { // if ADD_TO_GITIGNORE wasn't there to begin with
			finalLines = append([]string{usePatternsFlagContent}, finalLines...)
		}
		newLines = finalLines
	}

	// Clean up potential duplicate blank lines
	var finalOutputLines []string
	for i, line := range newLines {
		if i > 0 && strings.TrimSpace(line) == "" && strings.TrimSpace(newLines[i-1]) == "" {
			continue
		}
		finalOutputLines = append(finalOutputLines, line)
	}

	return os.WriteFile(snapshotignorePath, []byte(strings.Join(finalOutputLines, "\n")), 0644)
}

// interactiveConfiguration handles the first-run setup questions for the user.
func interactiveConfiguration(projectRoot string) error {
	config, err := getSnapshotignoreConfig(projectRoot)
	if err != nil {
		return fmt.Errorf("could not get snapshot config: %w", err)
	}
	configChangedThisSession := false

	// --- Feature 1: Use .gitignore patterns ---
	if !config.UseGitignorePatternsIsSet {
		fmt.Println("\n❓ Setting: Should snapshots also ignore file/folder patterns from your project's '.gitignore'?")
		fmt.Println("   (Example: node_modules, .env, build outputs are often in .gitignore)")
		fmt.Println("   1. YES - Exclude '.gitignore' patterns from snapshots (recommended).")
		fmt.Println("   2. NO  - Only use '.snapshotignore' patterns for snapshot exclusions.")

		var choice string
		for choice != "1" && choice != "2" {
			choice, _ = askUser("   Your choice for using .gitignore patterns (1 or 2): ")
			if choice != "1" && choice != "2" {
				fmt.Println("     Invalid choice. Please enter 1 or 2.")
			}
		}
		usePatterns := (choice == "1")
		config.UseGitignorePatterns = &usePatterns
		config.UseGitignorePatternsIsSet = true
		configChangedThisSession = true
		if usePatterns {
			fmt.Println("   => Decision: Snapshots will now use '.gitignore' patterns. This is saved in '.snapshotignore'.")
		} else {
			fmt.Println("   => Decision: Snapshots will not use '.gitignore' patterns. This is saved in '.snapshotignore'.")
		}
	}

	// --- Feature 2: Manage __snapshots__/ in .gitignore ---
	projectGitignorePath := filepath.Join(projectRoot, gitignoreFileName)
	gitignoreContent, err := os.ReadFile(projectGitignorePath)
	projectGitignoreExists := !os.IsNotExist(err)

	snapshotsDirInGitignore := false
	if projectGitignoreExists {
		re := regexp.MustCompile(`(?m)^` + regexp.QuoteMeta(snapshotsDirName+"/") + `\s*$`)
		snapshotsDirInGitignore = re.Match(gitignoreContent)
	}

	if snapshotsDirInGitignore {
		if config.ManageGitignoreEntry {
			fmt.Printf("\nℹ️  Setting: Ensuring '%s/' is in your project's '.gitignore'.\n", snapshotsDirName)
			fmt.Printf("   Status: '%s/' is already present in project's '.gitignore'.\n", snapshotsDirName+"/")
			config.ManageGitignoreEntry = false
			config.ManageGitignoreEntryIsSet = true
			configChangedThisSession = true
			fmt.Println("   => Action: No changes needed to '.gitignore'. Future prompts for this are now disabled in '.snapshotignore'.")
		}
	} else if config.ManageGitignoreEntry {
		if !projectGitignoreExists {
			fmt.Printf("\nℹ️  Setting: Ensuring '%s/' is in your project's '.gitignore'.\n", snapshotsDirName)
			fmt.Println("   Status: Your project does not have a '.gitignore' file.")
			config.ManageGitignoreEntry = false
			config.ManageGitignoreEntryIsSet = true
			configChangedThisSession = true
			fmt.Printf("   => Action: Cannot add '%s/'. Future prompts for this are now disabled in '.snapshotignore'.\n", snapshotsDirName)
		} else {
			fmt.Printf("\n❓ Setting: Add snapshot directory ('%s/') to your project's '.gitignore'?\n", snapshotsDirName)
			fmt.Println("   (This is recommended to prevent committing local snapshots to your Git repository).")
			fmt.Printf("   1. YES - Add '%s/' to '.gitignore' (and don't ask again for this project).\n", snapshotsDirName+"/")
			fmt.Println("   2. NO (Ask again next time) - Don't add now, but remind me next time.")
			fmt.Println("   3. NO (Stop asking) - Don't add, and stop asking for this project.")

			var choice string
			for choice != "1" && choice != "2" && choice != "3" {
				choice, _ = askUser(fmt.Sprintf("   Your choice for adding '%s/' to project's .gitignore (1, 2, or 3): ", snapshotsDirName))
				if choice != "1" && choice != "2" && choice != "3" {
					fmt.Println("     Invalid choice. Please enter 1, 2, or 3.")
				}
			}

			config.ManageGitignoreEntryIsSet = true
			configChangedThisSession = true

			switch choice {
			case "1":
				newContent := string(gitignoreContent)
				if len(newContent) > 0 && !strings.HasSuffix(newContent, "\n") {
					newContent += "\n"
				}
				newContent += fmt.Sprintf("\n# snapshot.go: Ignore local snapshots directory\n%s/\n", snapshotsDirName)
				os.WriteFile(projectGitignorePath, []byte(newContent), 0644)
				fmt.Printf("   => Action: '%s/' added to project's '.gitignore'. Future prompts for this are now disabled.\n", snapshotsDirName+"/")
				config.ManageGitignoreEntry = false
			case "2":
				fmt.Printf("   => Action: '%s/' not added. Will ask again next time.\n", snapshotsDirName+"/")
				config.ManageGitignoreEntry = true
			case "3":
				fmt.Printf("   => Action: '%s/' not added. Future prompts for this are now disabled.\n", snapshotsDirName+"/")
				config.ManageGitignoreEntry = false
			}
		}
	}

	if configChangedThisSession {
		err := setSnapshotignoreConfig(projectRoot, config)
		if err != nil {
			return fmt.Errorf("failed to save config to .snapshotignore: %w", err)
		}
		fmt.Println("\nℹ️  Configuration preferences saved to '.snapshotignore'.")
	}
	return nil
}

// loadIgnoreList compiles a set of patterns to ignore from .snapshotignore and optionally .gitignore.
func loadIgnoreList(projectRoot string) (map[string]struct{}, error) {
	ignoreSet := make(map[string]struct{})
	config, err := getSnapshotignoreConfig(projectRoot)
	if err != nil {
		return nil, err
	}

	// Read from .gitignore if configured
	if config.UseGitignorePatterns != nil && *config.UseGitignorePatterns {
		gitignorePath := filepath.Join(projectRoot, gitignoreFileName)
		file, err := os.Open(gitignorePath)
		if err == nil {
			scanner := bufio.NewScanner(file)
			for scanner.Scan() {
				trimmed := strings.TrimSpace(scanner.Text())
				if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
					ignoreSet[strings.TrimRight(trimmed, "/")] = struct{}{}
				}
			}
			file.Close()
		}
	}

	// Read from .snapshotignore
	snapshotignorePath := filepath.Join(projectRoot, snapshotignoreFileName)
	file, err := os.Open(snapshotignorePath)
	if err == nil {
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			trimmed := strings.TrimSpace(scanner.Text())
			if trimmed != "" && !strings.HasPrefix(trimmed, "#") {
				ignoreSet[strings.TrimRight(trimmed, "/")] = struct{}{}
			}
		}
		file.Close()
	}

	// Always ignore the snapshot directory itself
	ignoreSet[snapshotsDirName] = struct{}{}
	// Also ignore the script itself if it's in the root
	ignoreSet[filepath.Base(os.Args[0])] = struct{}{}

	return ignoreSet, nil
}

// isIgnored checks if a given relative path matches any pattern in the ignore set.
func isIgnored(relPath string, ignoreSet map[string]struct{}) bool {
	normalized := filepath.ToSlash(relPath)
	for pattern := range ignoreSet {
		// This is a simplified matcher, similar to the JS version.
		// It checks for exact match or if the path is a subdirectory of the pattern.
		if normalized == pattern || strings.HasPrefix(normalized, pattern+"/") {
			return true
		}
	}
	return false
}

// listFilesRecursively walks a directory and returns a slice of relative file paths, respecting ignores.
func listFilesRecursively(root string, ignoreSet map[string]struct{}) ([]string, error) {
	var fileList []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}
		
		// Skip the entire snapshot directory at the root
		if filepath.Base(path) == snapshotsDirName && filepath.Dir(path) == root {
			return filepath.SkipDir
		}

		if isIgnored(relPath, ignoreSet) {
			if d.IsDir() {
				return filepath.SkipDir // Don't descend into ignored directories
			}
			return nil // Skip ignored files
		}

		if !d.IsDir() {
			fileList = append(fileList, relPath)
		}
		return nil
	})
	return fileList, err
}

// hashFile computes the SHA1 hash of a file's content.
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

// compareSnapshots generates a diff between a snapshot directory and the current project directory.
func compareSnapshots(snapshotPath, currentPath string, ignoreSet map[string]struct{}) (DiffResult, error) {
	result := DiffResult{
		Base:    filepath.Base(snapshotPath),
		Compare: "current",
	}

	snapshotFiles, err := listFilesRecursively(snapshotPath, ignoreSet)
	if err != nil {
		return result, err
	}
	currentFiles, err := listFilesRecursively(currentPath, ignoreSet)
	if err != nil {
		return result, err
	}

	snapshotFileSet := make(map[string]struct{})
	for _, f := range snapshotFiles {
		snapshotFileSet[f] = struct{}{}
	}
	currentFileSet := make(map[string]struct{})
	for _, f := range currentFiles {
		currentFileSet[f] = struct{}{}
	}

	allFilesMap := make(map[string]struct{})
	for f := range snapshotFileSet {
		allFilesMap[f] = struct{}{}
	}
	for f := range currentFileSet {
		allFilesMap[f] = struct{}{}
	}

	var allFilesSorted []string
	for f := range allFilesMap {
		allFilesSorted = append(allFilesSorted, f)
	}
	sort.Strings(allFilesSorted)

	for _, relPath := range allFilesSorted {
		_, inSnap := snapshotFileSet[relPath]
		_, inCurr := currentFileSet[relPath]

		if inSnap && !inCurr {
			result.Files = append(result.Files, DiffFile{File: filepath.ToSlash(relPath), Status: "removed"})
		} else if !inSnap && inCurr {
			result.Files = append(result.Files, DiffFile{File: filepath.ToSlash(relPath), Status: "added"})
		} else if inSnap && inCurr {
			snapFilePath := filepath.Join(snapshotPath, relPath)
			currFilePath := filepath.Join(currentPath, relPath)
			snapHash, err1 := hashFile(snapFilePath)
			currHash, err2 := hashFile(currFilePath)
			if err1 != nil || err2 != nil {
				result.Files = append(result.Files, DiffFile{File: filepath.ToSlash(relPath), Status: "error_comparing"})
				continue
			}

			if snapHash != currHash {
				snapLines, _ := os.ReadFile(snapFilePath)
				currLines, _ := os.ReadFile(currFilePath)
				lineCountDiff := abs(strings.Count(string(currLines), "\n") - strings.Count(string(snapLines), "\n"))
				result.Files = append(result.Files, DiffFile{File: filepath.ToSlash(relPath), Status: "modified", LinesChanged: &lineCountDiff})
			}
		}
	}
	return result, nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// appendToLog adds a new entry to the snapshot.log file.
func appendToLog(snapshotRoot, prefix, label, folderName string) error {
	logPath := filepath.Join(snapshotRoot, snapshotLogFileName)
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logEntry := fmt.Sprintf("[%s] %s - \"%s\"\n-> %s\n\n", prefix, timestamp, label, folderName)
	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString(logEntry)
	return err
}

// savePrompt creates the AI-friendly prompt file.
func savePrompt(diffData DiffResult, index, snapshotName, snapshotDir string) error {
	promptContent := fmt.Sprintf("🧠 Snapshot Regression Summary: %s_%s\n\n", index, snapshotName)
	promptContent += "These files have changed since this working snapshot. Please review them to identify what may have broken:\n\n"

	jsonData, err := json.MarshalIndent(map[string][]DiffFile{"files": diffData.Files}, "", "  ")
	if err != nil {
		return err
	}
	promptContent += string(jsonData) + "\n"

	outputPath := filepath.Join(snapshotDir, fmt.Sprintf("prompt_%s_restore.txt", index))
	err = os.WriteFile(outputPath, []byte(promptContent), 0644)
	if err == nil {
		fmt.Printf("✅ Prompt saved to %s\n", outputPath)
	}
	return err
}

// restoreSnapshot restores files from a snapshot to the current directory.
func restoreSnapshot(snapshotPath, currentPath string, ignoreSet map[string]struct{}, dryRun bool) error {
	snapshotFiles, err := listFilesRecursively(snapshotPath, ignoreSet)
	if err != nil {
		return err
	}
	snapshotFileSet := make(map[string]struct{})
	for _, f := range snapshotFiles {
		snapshotFileSet[f] = struct{}{}
	}

	restored, skipped, deleted := 0, 0, 0

	// Restore/update files from snapshot
	for _, relPath := range snapshotFiles {
		snapFile := filepath.Join(snapshotPath, relPath)
		destFile := filepath.Join(currentPath, relPath)

		// Optimization: skip if hashes match
		destHash := ""
		if _, err := os.Stat(destFile); err == nil {
			destHash, _ = hashFile(destFile)
		}
		snapHash, _ := hashFile(snapFile)
		if snapHash == destHash {
			skipped++
			continue
		}

		if dryRun {
			fmt.Println("Would restore: " + relPath)
		} else {
			if err := os.MkdirAll(filepath.Dir(destFile), 0755); err != nil {
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
			fmt.Println("Restored: " + relPath)
		}
		restored++
	}

	// Delete files not in snapshot
	currentFiles, err := listFilesRecursively(currentPath, ignoreSet)
	if err != nil {
		return err
	}
	for _, relPath := range currentFiles {
		if _, exists := snapshotFileSet[relPath]; !exists {
			fullPath := filepath.Join(currentPath, relPath)
			if dryRun {
				fmt.Println("Would delete: " + relPath)
			} else {
				if err := os.Remove(fullPath); err == nil {
					fmt.Println("Deleted: " + relPath)
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

// --- Main CLI Logic ---

func main() {
	fmt.Println("")
	args := os.Args[1:]

	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to get current working directory: %v\n", err)
		os.Exit(1)
	}
	
	// Run interactive config if needed
	if err := interactiveConfiguration(projectRoot); err != nil {
		fmt.Fprintf(os.Stderr, "⚠️ Error during interactive configuration: %v. Proceeding with current/default settings.\n", err)
	}
	
	snapshotsRoot := filepath.Join(projectRoot, snapshotsDirName)
	if err := os.MkdirAll(snapshotsRoot, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to create snapshots directory: %s. Please check permissions.\n", snapshotsRoot)
		os.Exit(1)
	}

	var labelArgs []string
	hasDiff, hasPrompt, hasRestore, isDryRun := false, false, false, false
	for _, arg := range args {
		switch arg {
		case "--diff":
			hasDiff = true
		case "--prompt":
			hasPrompt = true
		case "--restore":
			hasRestore = true
		case "--dry-run":
			isDryRun = true
		default:
			if !strings.HasPrefix(arg, "--") {
				labelArgs = append(labelArgs, arg)
			}
		}
	}

	isAction := hasDiff || hasPrompt || hasRestore
	if isAction && len(labelArgs) == 0 {
		fmt.Fprintln(os.Stderr, "❌ Please specify a snapshot index for --diff/--prompt/--restore")
		os.Exit(1)
	}

	ignoreSet, err := loadIgnoreList(projectRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to load ignore list: %v\n", err)
		os.Exit(1)
	}
	
	// --- Handle Diff/Prompt/Restore ---
	if isAction {
		index := fmt.Sprintf("%04s", labelArgs[0])
		
		dirs, _ := os.ReadDir(snapshotsRoot)
		var matchingFolder string
		for _, dir := range dirs {
			if dir.IsDir() && strings.HasPrefix(dir.Name(), index+"_") {
				matchingFolder = dir.Name()
				break
			}
		}

		if matchingFolder == "" {
			fmt.Fprintf(os.Stderr, "❌ Snapshot folder not found for index %s\n", index)
			os.Exit(1)
		}
		snapshotPath := filepath.Join(snapshotsRoot, matchingFolder)

		if hasRestore {
			restoreMsg := fmt.Sprintf("♻️ Restoring snapshot: %s", matchingFolder)
			if isDryRun {
				restoreMsg += " (dry run)"
			}
			fmt.Println(restoreMsg)
			if err := restoreSnapshot(snapshotPath, projectRoot, ignoreSet, isDryRun); err != nil {
				fmt.Fprintf(os.Stderr, "❌ Restore failed: %v\n", err)
				os.Exit(1)
			}
			return
		}

		fmt.Println("📂 Found snapshot: " + matchingFolder)
		fmt.Println("🔍 Comparing against current working directory...")
		diffData, err := compareSnapshots(snapshotPath, projectRoot, ignoreSet)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Diff failed: %v\n", err)
			os.Exit(1)
		}

		diffOutputPath := filepath.Join(snapshotsRoot, fmt.Sprintf("diff_%s_to_current.json", index))
		jsonData, _ := json.MarshalIndent(diffData, "", "  ")
		if err := os.WriteFile(diffOutputPath, jsonData, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "❌ Could not save diff file: %v\n", err)
		} else {
			fmt.Println("✅ Diff complete. Saved to " + diffOutputPath)
		}
		
		if hasPrompt {
			snapshotName := strings.TrimPrefix(matchingFolder, index+"_")
			if err := savePrompt(diffData, index, snapshotName, snapshotsRoot); err != nil {
				fmt.Fprintf(os.Stderr, "❌ Could not save prompt file: %v\n", err)
			}
		}
		return
	}

	// --- Handle Snapshot Creation ---
	if len(labelArgs) == 0 {
		fmt.Fprintln(os.Stderr, "❌ Please provide a snapshot label or use --diff/--prompt/--restore with a snapshot index.")
		os.Exit(1)
	}

	labelRaw := strings.Join(labelArgs, " ")
	label := sanitizeLabel(labelRaw)
	if label == "" {
		fmt.Fprintln(os.Stderr, "❌ Invalid label provided. Please use a more descriptive label.")
		os.Exit(1)
	}

	nextIndex, err := getNextSnapshotIndex(snapshotsRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Could not determine next snapshot index: %v\n", err)
		os.Exit(1)
	}

	prefix := fmt.Sprintf("%04d", nextIndex)
	folderName := prefix + "_" + label
	snapshotDir := filepath.Join(snapshotsRoot, folderName)

	fmt.Println("📸 Creating snapshot: " + snapshotDir)
	if err := os.MkdirAll(snapshotDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to create snapshot directory: %v\n", err)
		os.Exit(1)
	}

	filesToCopy, err := listFilesRecursively(projectRoot, ignoreSet)
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Error listing files for snapshot: %v\n", err)
		os.Exit(1)
	}

	for _, relPath := range filesToCopy {
		srcPath := filepath.Join(projectRoot, relPath)
		destPath := filepath.Join(snapshotDir, relPath)

		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to create subdirectory in snapshot: %v\n", err)
			continue
		}

		src, err := os.Open(srcPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to open source file %s: %v\n", relPath, err)
			continue
		}
		defer src.Close()

		dst, err := os.Create(destPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to create destination file %s: %v\n", relPath, err)
			continue
		}
		defer dst.Close()

		_, err = io.Copy(dst, src)
		if err != nil {
			fmt.Fprintf(os.Stderr, "❌ Failed to copy file %s: %v\n", relPath, err)
		}
	}

	if err := appendToLog(snapshotsRoot, prefix, labelRaw, folderName); err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to write to snapshot log: %v\n", err)
	}

	fmt.Println("✅ Snapshot complete.")
}