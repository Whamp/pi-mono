import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { i18n } from "../utils/i18n.js";

export type DateRangeFilter = "all" | "today" | "last7" | "last30";

export interface SearchFiltersState {
	dateRange: DateRangeFilter;
	model: string | null;
}

export interface SearchFiltersProps {
	/** Current filter state */
	filters: SearchFiltersState;
	/** Available models extracted from sessions */
	availableModels: string[];
	/** Callback when filters change */
	onFiltersChange: (filters: SearchFiltersState) => void;
}

@customElement("pi-search-filters")
export class SearchFilters extends LitElement {
	@property({ attribute: false }) filters: SearchFiltersState = { dateRange: "all", model: null };
	@property({ attribute: false }) availableModels: string[] = [];
	@property({ attribute: false }) onFiltersChange?: (filters: SearchFiltersState) => void;

	protected override createRenderRoot(): HTMLElement | DocumentFragment {
		return this;
	}

	private handleDateRangeChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const dateRange = select.value as DateRangeFilter;
		if (this.onFiltersChange) {
			this.onFiltersChange({ ...this.filters, dateRange });
		}
	}

	private handleModelChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const model = select.value === "" ? null : select.value;
		if (this.onFiltersChange) {
			this.onFiltersChange({ ...this.filters, model });
		}
	}

	private getDateRangeLabel(value: DateRangeFilter): string {
		switch (value) {
			case "today":
				return i18n("Today");
			case "last7":
				return i18n("Last 7 Days");
			case "last30":
				return i18n("Last 30 Days");
			default:
				return i18n("All time");
		}
	}

	override render() {
		return html`
			<div class="flex flex-wrap gap-2 px-3 py-2 border-b border-border bg-muted/30">
				<!-- Date Range Filter -->
				<div class="flex items-center gap-1.5 text-xs">
					<label class="text-muted-foreground whitespace-nowrap" for="date-filter">${i18n("Date")}:</label>
					<select
						id="date-filter"
						class="px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
						.value=${this.filters.dateRange}
						@change=${this.handleDateRangeChange}
					>
						<option value="all">${this.getDateRangeLabel("all")}</option>
						<option value="today">${this.getDateRangeLabel("today")}</option>
						<option value="last7">${this.getDateRangeLabel("last7")}</option>
						<option value="last30">${this.getDateRangeLabel("last30")}</option>
					</select>
				</div>

				<!-- Model Filter -->
				<div class="flex items-center gap-1.5 text-xs">
					<label class="text-muted-foreground whitespace-nowrap" for="model-filter">${i18n("Model")}:</label>
					<select
						id="model-filter"
						class="px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer max-w-[120px] truncate"
						.value=${this.filters.model ?? ""}
						@change=${this.handleModelChange}
					>
						<option value="">${i18n("All")}</option>
						${this.availableModels.map(
							(model) => html`
								<option value=${model} class="truncate">${model}</option>
							`,
						)}
					</select>
				</div>
			</div>
		`;
	}
}

// Guard against duplicate registration
if (!customElements.get("pi-search-filters")) {
	customElements.define("pi-search-filters", SearchFilters);
}
