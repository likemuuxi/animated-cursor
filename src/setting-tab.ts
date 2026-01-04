import AnimatedCursorPlugin from "src/main";
import { App, PluginSettingTab, Setting } from "obsidian"

export class AnimatedCursorSettingTab extends PluginSettingTab {
	public readonly plugin: AnimatedCursorPlugin;

	constructor(app: App, plugin: AnimatedCursorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(this.containerEl)
			.setName("Slightly more smoothly")
			.setDesc(
				"If turned on, cursor moves slightly more smoothly, especially when the user moves it continously. " +
				"There is a downside, the cursor appears blurry."
			)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useTransform)
				.onChange(val => {
					this.plugin.settings.useTransform = val;
					this.plugin.saveSettings();
				})
			);

		// --- EFFECT SELECTION ---
		let currentEffect = "none";
		if (this.plugin.settings.comet.enabled) currentEffect = "comet";
		else if (this.plugin.settings.blink.enabled) currentEffect = "blink";

		new Setting(containerEl)
			.setName("Cursor Effect")
			.setDesc("Select the cursor animation effect.")
			.addDropdown(dropdown => dropdown
				.addOption("none", "None")
				.addOption("comet", "Comet Cursor")
				.addOption("blink", "Custom Blink Cursor")
				.setValue(currentEffect)
				.onChange(async (val) => {
					// Update settings based on selection
					this.plugin.settings.comet.enabled = (val === "comet");
					this.plugin.settings.blink.enabled = (val === "blink");
					await this.plugin.saveSettings();
					// Refresh UI to show/hide relevant options
					this.display();
				})
			);

		// --- DYNAMIC SETTINGS ---

		if (this.plugin.settings.comet.enabled) {
			new Setting(containerEl)
				.setName("Comet Color")
				.setDesc("Trailing tail color.")
				.addColorPicker(picker => picker
					.setValue(this.plugin.settings.comet.color)
					.onChange(val => {
						this.plugin.settings.comet.color = val;
						this.plugin.saveSettings();
					})
				);
		}

		if (this.plugin.settings.blink.enabled) {
			new Setting(containerEl)
				.setName("Blink Cursor Color")
				.setDesc("Color of the custom cursor and trail.")
				.addColorPicker(picker => picker
					.setValue(this.plugin.settings.blink.color)
					.onChange(val => {
						this.plugin.settings.blink.color = val;
						this.plugin.saveSettings();
					})
				);
		}

		// --- General Settings (Always visible if relevant) ---
		// Add back 'useTransform' if needed, but keeping it minimal for now per request.
	}

	public hide(): void {
		// Clear all components when the tab was hidden.
		this.containerEl.empty();
		super.hide();
	}
}
