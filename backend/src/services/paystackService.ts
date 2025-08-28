import axios, { AxiosInstance } from "axios";
import {
	IResolveAccountResponse,
	ICreateRecipientResponse,
	IInitiateTransferResponse,
} from "../types/paystack";

class PaystackService {
	private apiClient: AxiosInstance;

	constructor() {
		const secretKey = process.env.PAYSTACK_SECRET_KEY;
		if (!secretKey) {
			throw new Error("Paystack secret key not found in environment variables");
		}

		this.apiClient = axios.create({
			baseURL: "https://api.paystack.co",
			headers: {
				Authorization: `Bearer ${secretKey}`,
				"Content-Type": "application/json",
			},
		});
	}

	async getBankList(): Promise<any[]> {
		try {
			const response = await this.apiClient.get("/bank", {
				params: { country: "nigeria", perPage: 100 },
			});
			return response.data.data;
		} catch (error) {
			console.error("Paystack API Error (getBankList):", error.response?.data);
			throw new Error("Failed to fetch bank list from Paystack");
		}
	}

	async verifyAccountNumber(
		accountNumber: string,
		bankCode: string
	): Promise<IResolveAccountResponse> {
		try {
			const response = await this.apiClient.get("/bank/resolve", {
				params: { account_number: accountNumber, bank_code: bankCode },
			});
			return response.data;
		} catch (error) {
			console.error(
				"Paystack API Error (verifyAccountNumber):",
				error.response?.data
			);
			throw new Error(
				error.response?.data?.message ||
					"Failed to verify account number with Paystack"
			);
		}
	}

	async createTransferRecipient(
		name: string,
		accountNumber: string,
		bankCode: string
	): Promise<ICreateRecipientResponse> {
		try {
			const response = await this.apiClient.post("/transferrecipient", {
				type: "nuban",
				name,
				account_number: accountNumber,
				bank_code: bankCode,
				currency: "NGN",
			});
			return response.data;
		} catch (error) {
			console.error(
				"Paystack API Error (createTransferRecipient):",
				error.response?.data
			);
			throw new Error(
				error.response?.data?.message ||
					"Failed to create transfer recipient with Paystack"
			);
		}
	}

	async initiateTransfer(
		recipientCode: string,
		amount: number,
		reason: string
	): Promise<IInitiateTransferResponse> {
		try {
			// Amount should be in kobo (amount * 100)
			const amountInKobo = Math.round(amount * 100);
			const response = await this.apiClient.post("/transfer", {
				source: "balance",
				reason,
				amount: amountInKobo,
				recipient: recipientCode,
			});
			return response.data;
		} catch (error) {
			console.error(
				"Paystack API Error (initiateTransfer):",
				error.response?.data
			);
			throw new Error(
				error.response?.data?.message ||
					"Failed to initiate transfer with Paystack"
			);
		}
	}
}

export default new PaystackService();
