/**
 * Milestone 13: Researcher Marketplace
 * 
 * Evidence submission validation - ensures researchers submit proper evidence
 * with sources, observations, unknowns, and notes, not just AI-generated answers.
 */


/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate evidence submission
 */
export function validateEvidenceSubmission(
  evidence: Array<{
    statement: string;
    category: string;
    sourceUrl: string;
    businessId?: string;
    businessName?: string;
    confidence: number;
  }>,
  sources: Array<{
    url: string;
    title: string;
    type: "website" | "document" | "interview" | "observation" | "other";
  }>,
  observations: string[],
  unknowns: string[],
  notes: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Evidence validation
  if (evidence.length === 0) {
    errors.push("At least one evidence item is required");
  } else {
    for (let i = 0; i < evidence.length; i++) {
      const ev = evidence[i];
      
      if (!ev.statement || ev.statement.trim().length === 0) {
        errors.push(`Evidence item ${i + 1}: statement is required`);
      }
      
      if (!ev.category || ev.category.trim().length === 0) {
        errors.push(`Evidence item ${i + 1}: category is required`);
      }
      
      if (!ev.sourceUrl || ev.sourceUrl.trim().length === 0) {
        errors.push(`Evidence item ${i + 1}: source URL is required`);
      }
      
      if (ev.confidence < 0 || ev.confidence > 100) {
        errors.push(`Evidence item ${i + 1}: confidence must be between 0 and 100`);
      }
      
      // Check for AI-generated patterns
      if (isLikelyAIGenerated(ev.statement)) {
        warnings.push(`Evidence item ${i + 1}: statement appears to be AI-generated. Please provide human-verified evidence.`);
      }
    }
  }

  // Sources validation
  if (sources.length === 0) {
    errors.push("At least one source is required");
  } else {
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      
      if (!source.url || source.url.trim().length === 0) {
        errors.push(`Source ${i + 1}: URL is required`);
      }
      
      if (!source.title || source.title.trim().length === 0) {
        errors.push(`Source ${i + 1}: title is required`);
      }
      
      const validTypes = ["website", "document", "interview", "observation", "other"];
      if (!validTypes.includes(source.type)) {
        errors.push(`Source ${i + 1}: invalid type. Must be one of: ${validTypes.join(", ")}`);
      }
    }
  }

  // Observations validation
  if (observations.length === 0) {
    warnings.push("No observations provided. Adding observations helps verify evidence quality.");
  } else {
    for (let i = 0; i < observations.length; i++) {
      if (!observations[i] || observations[i].trim().length === 0) {
        errors.push(`Observation ${i + 1}: cannot be empty`);
      }
    }
  }

  // Unknowns validation
  if (unknowns.length === 0) {
    warnings.push("No unknowns provided. Acknowledging unknowns is important for research integrity.");
  } else {
    for (let i = 0; i < unknowns.length; i++) {
      if (!unknowns[i] || unknowns[i].trim().length === 0) {
        errors.push(`Unknown ${i + 1}: cannot be empty`);
      }
    }
  }

  // Notes validation
  if (!notes || notes.trim().length === 0) {
    errors.push("Notes are required to explain your research process");
  } else if (notes.trim().length < 50) {
    warnings.push("Notes should be more detailed to explain your research process");
  }

  // Check for evidence-source mapping
  const evidenceUrls = new Set(evidence.map(e => e.sourceUrl));
  const sourceUrls = new Set(sources.map(s => s.url));
  
  for (const url of Array.from(evidenceUrls)) {
    if (!sourceUrls.has(url)) {
      warnings.push(`Evidence references source URL "${url}" but it's not listed in sources`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if text appears to be AI-generated
 * This is a simple heuristic - in production, use more sophisticated detection
 */
function isLikelyAIGenerated(text: string): boolean {
  const aiPatterns = [
    /^(Based on|In conclusion|Therefore|Thus|Hence)/i,
    /^(It is important to note|It should be noted)/i,
    /^(Furthermore|Moreover|Additionally)/i,
    /^(The data suggests|The evidence indicates)/i,
    /^(This demonstrates|This shows)/i,
  ];

  return aiPatterns.some(pattern => pattern.test(text.trim()));
}

/**
 * Validate evidence item individually
 */
export function validateEvidenceItem(evidence: {
  statement: string;
  category: string;
  sourceUrl: string;
  confidence: number;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!evidence.statement || evidence.statement.trim().length === 0) {
    errors.push("Statement is required");
  } else if (evidence.statement.trim().length < 10) {
    warnings.push("Statement is very short. Provide more detail.");
  }

  if (!evidence.category || evidence.category.trim().length === 0) {
    errors.push("Category is required");
  }

  if (!evidence.sourceUrl || evidence.sourceUrl.trim().length === 0) {
    errors.push("Source URL is required");
  } else if (!isValidUrl(evidence.sourceUrl)) {
    errors.push("Source URL is invalid");
  }

  if (evidence.confidence < 0 || evidence.confidence > 100) {
    errors.push("Confidence must be between 0 and 100");
  } else if (evidence.confidence > 90) {
    warnings.push("Confidence is very high. Ensure this is justified by strong evidence.");
  }

  if (isLikelyAIGenerated(evidence.statement)) {
    warnings.push("Statement appears to be AI-generated. Please provide human-verified evidence.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate source item individually
 */
export function validateSourceItem(source: {
  url: string;
  title: string;
  type: string;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!source.url || source.url.trim().length === 0) {
    errors.push("URL is required");
  } else if (!isValidUrl(source.url)) {
    errors.push("URL is invalid");
  }

  if (!source.title || source.title.trim().length === 0) {
    errors.push("Title is required");
  }

  const validTypes = ["website", "document", "interview", "observation", "other"];
  if (!validTypes.includes(source.type)) {
    errors.push(`Invalid type. Must be one of: ${validTypes.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Simple URL validation
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if submission meets minimum quality standards
 */
export function meetsQualityStandards(
  evidenceCount: number,
  sourceCount: number,
  observationCount: number,
  unknownCount: number,
  notesLength: number
): { meetsStandards: boolean; reason: string } {
  if (evidenceCount < 3) {
    return { meetsStandards: false, reason: "At least 3 evidence items are required" };
  }

  if (sourceCount < 2) {
    return { meetsStandards: false, reason: "At least 2 sources are required" };
  }

  if (observationCount < 1) {
    return { meetsStandards: false, reason: "At least 1 observation is required" };
  }

  if (unknownCount < 1) {
    return { meetsStandards: false, reason: "At least 1 unknown must be acknowledged" };
  }

  if (notesLength < 100) {
    return { meetsStandards: false, reason: "Notes must be at least 100 characters" };
  }

  return { meetsStandards: true, reason: "Submission meets quality standards" };
}
