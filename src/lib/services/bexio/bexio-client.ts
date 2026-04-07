export class BexioClient {
  private baseUrl = "https://api.bexio.com";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Bexio API ${res.status}: ${err.message || JSON.stringify(err)}`);
    }
    return res.json();
  }

  async searchContacts(name: string): Promise<any[]> {
    return this.request("POST", "/2.0/contact/search", [
      { field: "name_1", value: name, criteria: "like" },
    ]);
  }

  async createContact(data: {
    name_1: string;
    name_2?: string;
    contact_type_id: number;
    owner_id: number;
  }): Promise<any> {
    return this.request("POST", "/2.0/contact", data);
  }

  async createManualEntry(data: any): Promise<any> {
    return this.request("POST", "/3.0/accounting/manual-entries", data);
  }

  async getAccounts(): Promise<any[]> {
    return this.request("GET", "/2.0/accounts");
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("GET", "/3.0/users/me");
      return true;
    } catch {
      return false;
    }
  }
}
