import { ConfigUtils } from "./config.utils";
import { Purchase } from "./fuel.utils";

export interface RunStats {
    departBatches: number;
    fuelBought: Purchase | null;
    co2Bought: Purchase | null;
    ecoFriendlyCreated: boolean;
    reputationCreated: boolean;
    planesChecked: boolean;
    planesRepaired: boolean;
    durationMs: number;
}

const EMBED_COLOR_SUCCESS = 0x2ecc71;
const EMBED_COLOR_FAILURE = 0xe74c3c;

export class DiscordUtils {
    // Optional on purpose: most people running this bot won't have Discord
    // notifications set up, and the bot should work fine without them.
    private webhookUrl?: string;

    constructor() {
        this.webhookUrl = ConfigUtils.optionalString('DISCORD_WEBHOOK_URL');
    }

    public async sendSuccessReport(stats: RunStats) {
        const fields = [
            {
                name: '✈️ Planes Departed',
                // We only know how many "depart 20-or-less" batches were
                // clicked, not the exact confirmed count, so this is an
                // upper bound rather than an exact number.
                value: stats.departBatches > 0
                    ? `${stats.departBatches} batch${stats.departBatches === 1 ? '' : 'es'} (up to ${stats.departBatches * 20} planes)`
                    : 'None',
                inline: true,
            },
            {
                name: '⛽ Fuel Bought',
                value: stats.fuelBought
                    ? `${stats.fuelBought.amount.toLocaleString()} L @ ${stats.fuelBought.price}`
                    : 'None',
                inline: true,
            },
            {
                name: '🌍 CO2 Bought',
                value: stats.co2Bought
                    ? `${stats.co2Bought.amount.toLocaleString()} @ ${stats.co2Bought.price}`
                    : 'None',
                inline: true,
            },
            {
                name: '📢 Eco-Friendly Campaign',
                value: stats.ecoFriendlyCreated ? 'Started' : 'Already running / skipped',
                inline: true,
            },
            {
                name: '⭐ Reputation Campaign',
                value: stats.reputationCreated ? 'Started' : 'Already running / skipped / disabled',
                inline: true,
            },
            {
                name: '🔧 Maintenance',
                value: `Checked: ${stats.planesChecked ? 'Yes' : 'No'} · Repaired: ${stats.planesRepaired ? 'Yes' : 'No'}`,
                inline: true,
            },
        ];

        await this.post({
            embeds: [{
                title: '✅ Airline Manager Bot Run Complete',
                color: EMBED_COLOR_SUCCESS,
                fields,
                footer: { text: `Took ${(stats.durationMs / 1000).toFixed(1)}s` },
                timestamp: new Date().toISOString(),
            }],
        });
    }

    public async sendFailureReport(error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        await this.post({
            embeds: [{
                title: '❌ Airline Manager Bot Run Failed',
                color: EMBED_COLOR_FAILURE,
                // Discord embed descriptions cap around 4096 chars; keep this
                // well under that so a huge stack trace can't get rejected.
                description: `\`\`\`${message.slice(0, 1500)}\`\`\``,
                timestamp: new Date().toISOString(),
            }],
        });
    }

    private async post(body: unknown) {
        if (!this.webhookUrl) {
            console.log('DISCORD_WEBHOOK_URL not set - skipping Discord notification.');
            return;
        }

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                console.error(`Discord webhook returned ${response.status}: ${await response.text()}`);
            }
        } catch (err) {
            // Never let a failed notification take down the actual bot run.
            console.error('Failed to send Discord notification:', err);
        }
    }
}
