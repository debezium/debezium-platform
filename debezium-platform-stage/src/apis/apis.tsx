import { QueryClient } from "react-query";

const queryClient = new QueryClient();

export type ApiResponse<T> = {
  data?: T | null;
  error?: string;
};

export type Vault = {
  name: string;
  id: number;
};

export type Transform = {
  name: string;
  id: number;
};

export type PipelineDestination = {
  name: string;
  id: number;
};

export type PipelineSource = {
  name: string;
  id: number;
};

export type DestinationConfig = {
  [key: string]: string; // Dynamic keys with string values
};

export type Payload = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: DestinationConfig;
  description?: string;
  name: string;
};

export type Destination = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: DestinationConfig;
  description?: string;
  name: string;
  id: number;
};

export type Pipeline = {
  name: string;
  id: number;
  source: PipelineSource;
  destination: PipelineDestination;
  description?: string;
  transforms: Transform[];
  logLevel: string;
};

export type PipelinePayload = {
  name: string;
  source: PipelineSource;
  destination: PipelineDestination;
  description?: string;
  transforms: Transform[];
  logLevel: string;
};

export type DestinationApiResponse = Destination[];

export type SourceConfig = {
  [key: string]: string; // Dynamic keys with string values
};

export type Source = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  description?: string;
  name: string;
  id: number;
};

export type Predicate = {
  type: string;
  config: Record<string, string>;
  negate?: boolean;
}

export type TransformData = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  description?: string;
  predicate?: Predicate;
  name: string;
  id: number;
};

export type TransformPayload = {
  type: string;
  schema: string;
  vaults: Vault[];
  config: SourceConfig;
  description?: string;
  predicate?: Predicate;
  name: string;
};

export type TransformApiResponse = TransformData[];

export type SourceApiResponse = Source[];

export type PipelineApiResponse = Pipeline[];

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
      const errorMsg = `Failed to create source: ${response.statusText}`;
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
      const errorMsg = `Failed to create source: ${response.statusText}`;
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
      // Add any additional headers if needed
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete data: ${response.statusText}`);
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
      const errorMsg = `Failed to verify the signals: ${response.statusText}`;
      return { error: errorMsg };
    }

    const data = await response.json();

    return { data };
  } catch (error) {
    console.error("Error verify the signals:", error);
    return { error: "An error occurred while verify the signals." };
  }
};
