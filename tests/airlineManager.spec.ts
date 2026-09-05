import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/general.utils';
import { FuelUtils } from '../utils/fuel.utils';
import { CampaignUtils } from '../utils/campaign.utils';
import { FleetUtils } from '../utils/fleet.utils';
import { MaintenanceUtils } from '../utils/maintenance.utils';
import { DiscordUtils, RunStats } from '../utils/discord.utils';

require('dotenv').config();

// Each depart pass is capped at this many "20-or-less" batches (~100 planes
// at 5 batches), so a single pass can never consume the whole test budget
// on a huge or continuously-refilling fleet. The depart/fuel cycle below
// repeats up to MAX_DEPART_FUEL_CYCLES times, buying fuel between each
// batch of departures, and stops early once there's genuinely nothing left
// to depart.
const DEPART_BATCH_CAP = 5;
const MAX_DEPART_FUEL_CYCLES = 5;

test('All Operations', async ({ page }) => {
  // Large fleets can need many depart-loop iterations (20 planes per click,
  // ~1.5s per click). 20 minutes gives headroom for a several-thousand
  // plane airline across the whole run; tune down if your fleet is small
  // and you'd rather fail fast.
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

  // Opens the routes screen, departs up to DEPART_BATCH_CAP batches, then
  // closes the popup again. Returns the DepartResult so the caller knows
  // whether the queue actually ran dry or just hit the cap.
  const departPass = async () => {
    console.log('Sweeping routes screen for planes to depart...');

    await page.locator('#mapRoutes').getByRole('img').click();
    await GeneralUtils.sleep(2500);

    const result = await fleetUtils.departPlanes(DEPART_BATCH_CAP);
    stats.departBatches += result.batches;

    await generalUtils.closePopup();
    await GeneralUtils.sleep(500);

    return result;
  };

  // Opens the fuel screen and tops up both fuel and CO2, keeping whatever
  // was actually bought last (a cycle where nothing gets bought - because
  // price was over the max threshold - shouldn't erase a previous cycle's
  // purchase in the stats).
  const buyFuelAndCo2 = async () => {
    await page.locator('#mapMaint > img').first().click();
    stats.fuelBought = (await fuelUtils.buyFuel()) ?? stats.fuelBought;

    await page.getByRole('button', { name: ' Co2' }).click();
    await GeneralUtils.sleep(1000);
    stats.co2Bought = (await fuelUtils.buyCo2()) ?? stats.co2Bought;

    await generalUtils.closePopup();
    await GeneralUtils.sleep(500);
  };

  try {
    // Login //
    await generalUtils.login(page);
    // End //

    // Depart / Fuel Cycle //
    // Alternates departing a batch of planes with topping up fuel/CO2, so a
    // huge fleet gets fuel refilled partway through instead of the bot
    // trying (and potentially running out of budget) to depart everything
    // in one pass before ever buying more fuel.
    for (let cycle = 1; cycle <= MAX_DEPART_FUEL_CYCLES; cycle++) {
      console.log(`Depart/fuel cycle ${cycle}/${MAX_DEPART_FUEL_CYCLES}...`);

      const departResult = await departPass();

      if (departResult.exhausted && departResult.batches === 0) {
        // Nothing was waiting to depart at all this cycle - no need to top
        // up fuel for flights that don't exist, and no point cycling further.
        console.log('Nothing left to depart - ending the depart/fuel cycle early.');
        break;
      }

      await buyFuelAndCo2();

      if (departResult.exhausted) {
        // We departed everything that was ready - stop cycling.
        console.log('Depart queue is empty - ending the depart/fuel cycle early.');
        break;
      }
    }
    // End //

    // Campaign Operations //
    await page.locator('div:nth-child(5) > #mapMaint > img').click();
    const campaignResult = await campaignUtils.createCampaign();
    stats.ecoFriendlyCreated = campaignResult.ecoFriendlyCreated;
    stats.reputationCreated = campaignResult.reputationCreated;

    await generalUtils.closePopup();
    await GeneralUtils.sleep(1000)
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
    // A single capped pass to catch anything freed up by maintenance
    // (e.g. a plane that was stuck under repair). Capped the same way as
    // the earlier cycle so this can't run away either.
    await departPass();
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
