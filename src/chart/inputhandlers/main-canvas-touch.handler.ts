/*
 * Copyright (C) 2019 - 2024 Devexperts Solutions IE Limited
 * This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */
import { ChartBaseElement } from '../model/chart-base-element';
import { CanvasInputListenerComponent } from '../inputlisteners/canvas-input-listener.component';
import { ScaleModel } from '../model/scale.model';
import { ChartAreaPanHandler } from '../components/chart/chart-area-pan.handler';
import { HitBoundsTest } from '../canvas/canvas-bounds-container';
import { Pixel } from '../model/scaling/viewport.model';

export const PIXELS_FOR_MOVE = 2;

/**
 * Handles chart touch events.
 */
export class MainCanvasTouchHandler extends ChartBaseElement {
	// 2 candles indexes touched by 2 fingers when pinching
	private touchedCandleIndexes: [number, number] = [0, 0];
	// stores the information about touch events
	public canvasTouchInfo: {
		touchStart: { x: Pixel; y: Pixel };
		isMoving?: boolean;
	} = {
		touchStart: { x: 0, y: 0 },
		// uses touch start to determine if chart is being moved
		isMoving: false,
	};
	constructor(
		private chartAreaPanHandler: ChartAreaPanHandler,
		private scale: ScaleModel,
		private canvasInputListeners: CanvasInputListenerComponent,
		private mainCanvasParent: Element,
		private hitTest: HitBoundsTest,
	) {
		super();
	}

	/**
	 * Activates canvas input listeners for touch start and touch move events.
	 * @protected
	 * @returns {void}
	 */
	protected doActivate(): void {
		this.addRxSubscription(
			this.canvasInputListeners.observeTouchStart(this.hitTest).subscribe(e => this.handleTouchStartEvent(e)),
		);
		this.addRxSubscription(
			this.canvasInputListeners.observeTouchMove(this.hitTest).subscribe(e => this.handleTouchMoveEvent(e)),
		);
		this.addRxSubscription(
			this.canvasInputListeners.observeTouchEndDocument().subscribe(e => this.handleTouchEndEvent(e)),
		);
	}

	/**
	 * Handles the touch start event.
	 * @param {TouchEvent} e - The touch event.
	 * @returns {void}
	 */
	private handleTouchStartEvent(e: TouchEvent) {
		const { clientX, clientY } = e.touches[0];

		if (e.touches.length === 1) {
			this.canvasTouchInfo.touchStart = { x: clientX, y: clientY };
		}

		if (e.touches.length === 2) {
			this.chartAreaPanHandler.deactivate();
			// @ts-ignore
			// TODO rework this
			this.touchedCandleIndexes = this.getXPositions(e).map(x => this.scale.fromX(x));
		}
	}

	/**
	 * Handles touch move event
	 * @param {TouchEvent} e - The touch event object
	 * @returns {void}
	 */
	private handleTouchMoveEvent(e: TouchEvent): void {
		const { clientX, clientY } = e.touches[0];
		const { touchStart } = this.canvasTouchInfo;

		if (e.touches.length === 1) {
			this.canvasTouchInfo.isMoving = checkChartIsMoving(clientX, touchStart.x, clientY, touchStart.y);
		}

		if (e.touches.length === 2) {
			this.pinchHandler(this.touchedCandleIndexes, this.getXPositions(e));
		}
	}
	/**
	 * Handles touch end event
	 * @returns {void}
	 */
	private handleTouchEndEvent(e: TouchEvent): void {
		this.canvasTouchInfo.isMoving = false;
		// zero touches means the user stopped resizing completely (both fingers are up)
		if (e.touches.length === 0) {
			this.chartAreaPanHandler.activate();
		}
	}
	/**
	 * Gets candle positions touched by user in pixels.
	 * @param e - touch event with "touches" array
	 * @return Array<number> - X coordinates of touches on the canvas
	 */
	private getXPositions(e: TouchEvent): [number, number] {
		const rect = this.mainCanvasParent.getBoundingClientRect();
		const result: [number, number] = [0, 0];
		// TO DO: check if this body calculations can potentially works wrong in widget
		const scrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
		for (let i = 0, l = e.touches.length; i < l; i++) {
			const touch = e.touches[i];
			result[i] = touch.pageX - rect.left - scrollLeft;
		}
		return result;
	}

	/**
	 * Handles the pinch gesture on the chart.
	 * @param {Array<number>} candleIndexes - An array of two numbers representing the indexes of the first and last visible candles on the chart.
	 * @param {number[]} touchPositions - An array of two numbers representing the touch positions on the screen.
	 * @returns {void}
	 */
	public pinchHandler(candleIndexes: Array<number>, touchPositions: number[]): void {
		const first =
			(touchPositions[0] * candleIndexes[1] - touchPositions[1] * candleIndexes[0]) /
			(touchPositions[0] - touchPositions[1]);
		const last =
			first +
			((candleIndexes[0] - candleIndexes[1]) / (touchPositions[0] - touchPositions[1])) *
				this.scale.getBounds().width;

		if (first >= last || touchPositions[0] === touchPositions[1]) {
			return;
		}

		this.scale.setXScale(first, last);
	}
}

export const checkChartIsMoving = (x1: Pixel, x2: Pixel, y1: Pixel, y2: Pixel, pixelsToMove: Pixel = PIXELS_FOR_MOVE) =>
	Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)) > pixelsToMove;
