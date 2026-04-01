export const TRUNCATION_MARKER = "\n[...] truncated by Promptfire";

export interface TruncationResult {
  text: string;
  wasTruncated: boolean;
}

export function truncateText(text: string, maxLength: number): TruncationResult {
  if (text.length <= maxLength) {
    return { text, wasTruncated: false };
  }

  if (maxLength <= 0) {
    return { text: "", wasTruncated: true };
  }

  if (maxLength <= TRUNCATION_MARKER.length) {
    return {
      text: TRUNCATION_MARKER.slice(0, maxLength),
      wasTruncated: true,
    };
  }

  const sliceLength = maxLength - TRUNCATION_MARKER.length;

  return {
    text: `${text.slice(0, sliceLength).trimEnd()}${TRUNCATION_MARKER}`,
    wasTruncated: true,
  };
}
