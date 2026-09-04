import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/general.utils';
import { FuelUtils } from '../utils/fuel.utils';
import { CampaignUtils } from '../utils/campaign.utils';
import { FleetUtils } from '../utils/fleet.utils';
import { MaintenanceUtils } from '../utils/maintenance.utils';
import { DiscordUtils, RunStats } from '../utils/discord.utils';

require('dotenv').config();

test('All Operations', async ({ page }) => {
  // Large fleets can need hundreds of depart-loop iterations (20 planes per
  // click, ~1.5s per click), across 3 sweeps in this run. 20 minutes gives
  // headroom for a several-thousand-plane airline; tune down if your fleet
  // is small and you'd rather fail fast.
  test.setTimeout(20 * 60 * 1000);

  // Variable Initialization
  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const fleetUtils = new FleetUtils(page);
  const maintenanceUtils = new MaintenanceUtils(page);
  const discordUtils = new DiscordUtils();
  // End //

  const startTime = Date.now();

  const stats: RunStats = {
    departBatches: 0,
    fuelBought: null,
    co2Bought: null,
    ecoFriendlyCreated: false,
    reputationCreated: false,
    planesChecked: false,
    planesRepaired: false,
    durationMs: 0,
  };

  // Opens the routes screen, departs everything currently ready, then closes
  // the popup again. Called at several points below so planes that finish
  // loading/refueling partway through the run still get departed, rather
  // than only catching whatever's ready at the very end.
  const departSweep = async () => {
    console.log('Sweeping routes screen for planes to depart...');

    await page.locator('#mapRoutes').getByRole('img').click();
    await GeneralUtils.sleep(2500);

    stats.departBatches += await fleetUtils.departPlanes();

    await generalUtils.closePopup();
    await GeneralUtils.sleep(500);
  };

  try {
    // Login //
    await generalUtils.login(page);
    // End //

    // Depart Planes Operations (early pass) //
    await departSweep();
    // End //

    // Fuel Operations //
    await page.locator('#mapMaint > img').first().click();
    stats.fuelBought = await fuelUtils.buyFuel();

    await page.getByRole('button', { name: ' Co2' }).click();
    await GeneralUtils.sleep(1000);
    stats.co2Bought = await fuelUtils.buyCo2();

    await generalUtils.closePopup();
    // End //

    // Campaign Operations //
    await page.locator('div:nth-child(5) > #mapMaint > img').click();
    const campaignResult = await campaignUtils.createCampaign();
    stats.ecoFriendlyCreated = campaignResult.ecoFriendlyCreated;
    stats.reputationCreated = campaignResult.reputationCreated;

    await generalUtils.closePopup();
    await GeneralUtils.sleep(1000)
    // End //

    // Depart Planes Operations (mid-run pass) //
    await departSweep();
    // End //

    // Check Planes //
    await page.locator('div:nth-child(4) > #mapMaint > img').click();
    await GeneralUtils.sleep(1000);

    stats.planesChecked = await maintenanceUtils.checkPlanes();

    await generalUtils.closePopup();
    await GeneralUtils.sleep(500);
    // End //

    // Repair Planes if needed //
    // Reopens the maintenance popup fresh rather than reusing the one above
    // - closing and reopening resets the panel to its default tab, so
    // nothing left over from the check step (e.g. a still-visible "Plan
    // bulk check" button) can collide with the " Plan" button clicked here.
    await page.locator('div:nth-child(4) > #mapMaint > img').click();
    await GeneralUtils.sleep(1000);

    stats.planesRepaired = await maintenanceUtils.repairPlanes();
    await GeneralUtils.sleep(1000);

    await generalUtils.closePopup();
    // End //

    // Depart Planes Operations (final pass) //
    await departSweep();
    // End //

    stats.durationMs = Date.now() - startTime;
    await discordUtils.sendSuccessReport(stats);
  } catch (error) {
    await discordUtils.sendFailureReport(error);
    throw error; // Still fail the Playwright test/CI job as normal.
  } finally {
    await page.close();
  }
});
