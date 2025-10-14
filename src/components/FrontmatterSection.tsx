// /src/components/FrontmatterSection.tsx
// Component for collapsible frontmatter section in the markdown editor

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface FrontmatterSectionProps {
	frontmatterContent: string;
	onFrontmatterChange?: (newContent: string) => void;
	collapsed?: boolean;
}

// Regex for extracting frontmatter - defined at module level for performance
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;

/**
 * FrontmatterSection component
 * Displays frontmatter in a collapsible section with "Properties" label
 * When collapsed, shows a single line with expand icon
 * When expanded, shows the full frontmatter content in a textarea
 */
export const FrontmatterSection: React.FC<FrontmatterSectionProps> = ({
	frontmatterContent,
	onFrontmatterChange,
	collapsed = true,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(collapsed);

	const toggleCollapse = () => {
		setIsCollapsed(!isCollapsed);
	};

	const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		if (onFrontmatterChange) {
			onFrontmatterChange(e.target.value);
		}
	};

	// Memoize field count calculation to avoid repeated string operations
	const fieldCount = useMemo(() => {
		return frontmatterContent
			.split('\n')
			.filter(line => line.trim() && !line.trim().startsWith('---'))
			.length;
	}, [frontmatterContent]);

	// Memoize rows calculation to avoid repeated string operations
	const textareaRows = useMemo(() => {
		return frontmatterContent.split('\n').length;
	}, [frontmatterContent]);

	return (
		<div className="frontmatter-section">
			<div className="frontmatter-header" onClick={toggleCollapse}>
				<span className="frontmatter-icon">
					{isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
				</span>
				<span className="frontmatter-label">Properties</span>
				<span className="frontmatter-count">
					{fieldCount} fields
				</span>
			</div>
			{!isCollapsed && (
				<div className="frontmatter-content">
					<textarea
						className="frontmatter-textarea"
						value={frontmatterContent}
						onChange={handleContentChange}
						rows={textareaRows}
						spellCheck={false}
					/>
				</div>
			)}
		</div>
	);
};

/**
 * Extract frontmatter from content
 * @param content - Full markdown content
 * @returns Object with frontmatter and body content
 */
export function extractFrontmatterFromMarkdown(content: string): {
	hasFrontmatter: boolean;
	frontmatter: string;
	body: string;
} {
	const match = content.match(FRONTMATTER_REGEX);

	if (match) {
		return {
			hasFrontmatter: true,
			frontmatter: match[1],
			body: content.slice(match[0].length),
		};
	}

	return {
		hasFrontmatter: false,
		frontmatter: "",
		body: content,
	};
}

/**
 * Reconstruct content from frontmatter and body
 * @param frontmatter - Frontmatter content (without delimiters)
 * @param body - Body content
 * @returns Full markdown content
 */
export function reconstructMarkdownWithFrontmatter(
	frontmatter: string,
	body: string
): string {
	if (!frontmatter.trim()) {
		return body;
	}
	return `---\n${frontmatter}\n---\n${body}`;
}
