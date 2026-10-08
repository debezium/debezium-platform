import { QueryClient } from "react-query";
import { API_URL } from "../utils/constants";

const queryClient = new QueryClient();

export type ApiResponse<T> = {
  data?: T | null;
  error?: string;
};

export const createPost = async <T,>(
  url: string,
  payload: unknown
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = `Failed to create source: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.details && errJson.details.length > 0) {
          errorMsg = errJson.details[0];
        } else if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch {
        // ignore
      }
      return { error: errorMsg };
    }

    const data = await response.json();
    // Refresh data after source is created
    queryClient.invalidateQueries("sources");

    return { data };
  } catch (error) {
    console.error("Error creating source:", error);
    return { error: "An error occurred while creating source" };
  }
};

export const editPut = async <T,>(
  url: string,
  payload: unknown
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = `Failed to create source: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.details && errJson.details.length > 0) {
          errorMsg = errJson.details[0];
        } else if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch {
        // ignore
      }
      return { error: errorMsg };
    }

    const data = await response.json();
    // Refresh data after source is created
    queryClient.invalidateQueries("sources");

    return { data };
  } catch (error) {
    console.error("Error creating source:", error);
    return { error: "An error occurred while creating source" };
  }
};

export const fetchData = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.statusText}`);
  }
  return response.json();
};

export const deleteData = async (url: string): Promise<void> => {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete data: ${response.status} ${response.statusText}`;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const body = await response.json();
        const serverMessage = body?.message || body?.error;
        const details = Array.isArray(body?.details)
          ? body.details.join("\n")
          : body?.details;

        if (serverMessage || details) {
          errorMessage = [serverMessage, details].filter(Boolean).join(": ");
        }
      } else {
        // Fallback to plain text 
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      }
    } catch (e) {
      console.error("Error deleting data:", e);
    }

    throw new Error(errorMessage);
  }
};

export const fetchDataTypeTwo = async <T,>(
  url: string
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `Failed to fetch data: ${response.statusText}`;
      return { error: errorMsg };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Error fetching data:", error);
    return { error: "An error occurred while fetching data" };
  }
};

export const fetchFile = async (
  url: string
): Promise<Blob | { error: string }> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorMsg = `Failed to fetch file: ${response.statusText}`;
      return { error: errorMsg };
    }

    // Return the response as a Blob
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Error fetching file:", error);
    return { error: "An error occurred while fetching the file" };
  }
};

export const verifySignals = async <T,>(
  url: string,
  payload: unknown
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMsg = `Failed to verify the signals: ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson?.violations?.length > 0) {
          errorMsg = errJson.violations[0].field + ":" + errJson.violations[0].message;
        } else if (errJson?.details?.length > 0) {
          errorMsg = errJson.details[0];
        } else if (errJson?.error) {
          errorMsg = errJson.error;
        } else if (errJson?.message) {
          errorMsg = errJson.message;
        }
      } catch {
        // ignore
      }
      return { error: errorMsg };
    }

    const data = await response.json();

    return { data };
  } catch (error) {
    console.error("Error verify the signals:", error);
    return { error: "An error occurred while verify the signals." };
  }
};


export interface ApiResponseUpdated<T> {
  data?: T;
  error?: {
    status: number;
    statusText: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
  };
}


export const fetchDataCall = async <T,>(
  url: string,
): Promise<ApiResponseUpdated<T>> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        // fallback if response is not JSON
        errorBody = await response.text();
      }

      return {
        error: {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        },
      };
    }

    const data = (await response.json()) as T;
    return { data };
  } catch (error) {
    console.error("Error fetching data:", error);
    return {
      error: {
        status: 0, // network or unexpected error
        statusText: "Network or unexpected error",
        body: (error as Error).message,
      },
    };
  }
};

// Monitoring API Functions
export const fetchMonitoringPanels = async (
  options?: { bustCache?: boolean }
): Promise<ApiResponse<import('./types').PanelsListResponse>> => {
  try {
    let url = `${API_URL}/api/monitoring/panels`;
    if (options?.bustCache) {
      url += `?_${Date.now()}`;
    }

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const errorMsg = `Failed to fetch monitoring panels: ${response.statusText}`;
      return { error: errorMsg };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Error fetching monitoring panels:", error);
    return { error: "An error occurred while fetching monitoring panels" };
  }
};

export const fetchPanelData = async (
  panelId: string,
  pipelineName: string,
  start: string,
  end: string,
  step?: string
): Promise<ApiResponse<import('./types').PanelQueryResponse>> => {
  try {
    const params = new URLSearchParams({
      pipeline_id: pipelineName,
      start,
      end,
    });

    if (step) {
      params.append("step", step);
    }

    const response = await fetch(
      `${API_URL}/api/monitoring/panels/${panelId}/query?${params.toString()}`
    );

    if (!response.ok) {
      const errorMsg = `Failed to fetch panel data: ${response.statusText}`;
      return { error: errorMsg };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error(`Error fetching panel data for ${panelId}:`, error);
    return { error: `An error occurred while fetching data for panel ${panelId}` };
  }
};
