import { vi } from 'vitest';

export const mockNavigate = vi.fn();

export const setupMocks = () => {
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
      ...actual,
      useNavigate: () => mockNavigate,
    };
  });

  vi.mock("./AppContext", () => ({
    useData: vi.fn(),
  }));
};