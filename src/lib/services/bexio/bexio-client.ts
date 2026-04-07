export class BexioClient {
  private baseUrl = "https://api.bexio.com";
  private token: string;
  private cachedOwnerId: number | null = null;
  private accountsCache: any[] | null = null;
  private taxesCache: any[] | null = null;

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

  async getOwnerId(): Promise<number> {
    if (this.cachedOwnerId) return this.cachedOwnerId;
    try {
      const me = await this.request<any>("GET", "/3.0/users/me");
      this.cachedOwnerId = me.id;
      return me.id;
    } catch {
      return 1;
    }
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

  async getAccountsCached(): Promise<any[]> {
    if (this.accountsCache) return this.accountsCache;
    this.accountsCache = await this.request<any[]>("GET", "/2.0/accounts");
    return this.accountsCache;
  }

  async getAccounts(): Promise<any[]> {
    return this.getAccountsCached();
  }

  async searchAccountByNumber(accountNumber: string): Promise<any | null> {
    const accounts = await this.getAccountsCached();
    return accounts.find((a: any) => String(a.account_no) === accountNumber) || null;
  }

  async getTaxesCached(): Promise<any[]> {
    if (this.taxesCache) return this.taxesCache;
    this.taxesCache = await this.request<any[]>("GET", "/3.0/taxes");
    return this.taxesCache;
  }

  async getTaxes(): Promise<any[]> {
    return this.getTaxesCached();
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
