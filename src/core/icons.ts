import { UIType } from './types';
import { parseSvgString } from './brandIcons';

// Duotone SVGs for 12 card types
import flowDuo from '@phosphor-icons/core/assets/duotone/tree-structure-duotone.svg?raw';
import stepperDuo from '@phosphor-icons/core/assets/duotone/steps-duotone.svg?raw';
import tableDuo from '@phosphor-icons/core/assets/duotone/table-duotone.svg?raw';
import compareDuo from '@phosphor-icons/core/assets/duotone/scales-duotone.svg?raw';
import quizDuo from '@phosphor-icons/core/assets/duotone/question-duotone.svg?raw';
import chartDuo from '@phosphor-icons/core/assets/duotone/chart-bar-duotone.svg?raw';
import mermaidDuo from '@phosphor-icons/core/assets/duotone/graph-duotone.svg?raw';
import calloutDuo from '@phosphor-icons/core/assets/duotone/info-duotone.svg?raw';
import statsDuo from '@phosphor-icons/core/assets/duotone/trend-up-duotone.svg?raw';
import tabsDuo from '@phosphor-icons/core/assets/duotone/tabs-duotone.svg?raw';
import timelineDuo from '@phosphor-icons/core/assets/duotone/hourglass-duotone.svg?raw';
import followupsDuo from '@phosphor-icons/core/assets/duotone/sparkle-duotone.svg?raw';
import functionDuo from '@phosphor-icons/core/assets/duotone/function-duotone.svg?raw';
import codeBlockDuo from '@phosphor-icons/core/assets/duotone/code-block-duotone.svg?raw';

// Regular SVGs for UI chrome & common allowlist
import exportReg from '@phosphor-icons/core/assets/regular/export.svg?raw';
import downloadSimpleReg from '@phosphor-icons/core/assets/regular/download-simple.svg?raw';
import imageReg from '@phosphor-icons/core/assets/regular/image.svg?raw';
import copyReg from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import codeReg from '@phosphor-icons/core/assets/regular/code.svg?raw';
import cornersOutReg from '@phosphor-icons/core/assets/regular/corners-out.svg?raw';
import cornersInReg from '@phosphor-icons/core/assets/regular/corners-in.svg?raw';
import xReg from '@phosphor-icons/core/assets/regular/x.svg?raw';
import checkReg from '@phosphor-icons/core/assets/regular/check.svg?raw';
import caretDownReg from '@phosphor-icons/core/assets/regular/caret-down.svg?raw';
import caretUpReg from '@phosphor-icons/core/assets/regular/caret-up.svg?raw';
import caretLeftReg from '@phosphor-icons/core/assets/regular/caret-left.svg?raw';
import caretRightReg from '@phosphor-icons/core/assets/regular/caret-right.svg?raw';
import arrowRightReg from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowLeftReg from '@phosphor-icons/core/assets/regular/arrow-left.svg?raw';
import arrowUpRightReg from '@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw';
import arrowSquareOutReg from '@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw';
import robotReg from '@phosphor-icons/core/assets/regular/robot.svg?raw';
import sparkleReg from '@phosphor-icons/core/assets/regular/sparkle.svg?raw';
import shieldCheckReg from '@phosphor-icons/core/assets/regular/shield-check.svg?raw';
import eyeReg from '@phosphor-icons/core/assets/regular/eye.svg?raw';
import playReg from '@phosphor-icons/core/assets/regular/play.svg?raw';
import globeReg from '@phosphor-icons/core/assets/regular/globe.svg?raw';
import lockReg from '@phosphor-icons/core/assets/regular/lock.svg?raw';
import hardDrivesReg from '@phosphor-icons/core/assets/regular/hard-drives.svg?raw';
import databaseReg from '@phosphor-icons/core/assets/regular/database.svg?raw';
import lightningReg from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import rocketReg from '@phosphor-icons/core/assets/regular/rocket.svg?raw';
import clockReg from '@phosphor-icons/core/assets/regular/clock.svg?raw';
import usersReg from '@phosphor-icons/core/assets/regular/users.svg?raw';
import userReg from '@phosphor-icons/core/assets/regular/user.svg?raw';
import cloudReg from '@phosphor-icons/core/assets/regular/cloud.svg?raw';
import chartLineReg from '@phosphor-icons/core/assets/regular/chart-line.svg?raw';
import cpuReg from '@phosphor-icons/core/assets/regular/cpu.svg?raw';
import wifiHighReg from '@phosphor-icons/core/assets/regular/wifi-high.svg?raw';
import bellReg from '@phosphor-icons/core/assets/regular/bell.svg?raw';
import calendarReg from '@phosphor-icons/core/assets/regular/calendar.svg?raw';
import envelopeReg from '@phosphor-icons/core/assets/regular/envelope.svg?raw';
import chatCircleReg from '@phosphor-icons/core/assets/regular/chat-circle.svg?raw';
import chatsCircleReg from '@phosphor-icons/core/assets/regular/chats-circle.svg?raw';
import heartReg from '@phosphor-icons/core/assets/regular/heart.svg?raw';
import starReg from '@phosphor-icons/core/assets/regular/star.svg?raw';
import magnifyingGlassReg from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import gearReg from '@phosphor-icons/core/assets/regular/gear.svg?raw';
import fileTextReg from '@phosphor-icons/core/assets/regular/file-text.svg?raw';
import folderReg from '@phosphor-icons/core/assets/regular/folder.svg?raw';
import terminalReg from '@phosphor-icons/core/assets/regular/terminal.svg?raw';
import tagReg from '@phosphor-icons/core/assets/regular/tag.svg?raw';
import compassReg from '@phosphor-icons/core/assets/regular/compass.svg?raw';
import mapPinReg from '@phosphor-icons/core/assets/regular/map-pin.svg?raw';
import creditCardReg from '@phosphor-icons/core/assets/regular/credit-card.svg?raw';
import walletReg from '@phosphor-icons/core/assets/regular/wallet.svg?raw';
import shoppingCartReg from '@phosphor-icons/core/assets/regular/shopping-cart.svg?raw';
import packageReg from '@phosphor-icons/core/assets/regular/package.svg?raw';
import cubeReg from '@phosphor-icons/core/assets/regular/cube.svg?raw';
import hardDriveReg from '@phosphor-icons/core/assets/regular/hard-drive.svg?raw';
import laptopReg from '@phosphor-icons/core/assets/regular/laptop.svg?raw';
import desktopReg from '@phosphor-icons/core/assets/regular/desktop.svg?raw';
import deviceMobileReg from '@phosphor-icons/core/assets/regular/device-mobile.svg?raw';
import cameraReg from '@phosphor-icons/core/assets/regular/camera.svg?raw';
import videoReg from '@phosphor-icons/core/assets/regular/video.svg?raw';
import musicNoteReg from '@phosphor-icons/core/assets/regular/music-note.svg?raw';
import bookReg from '@phosphor-icons/core/assets/regular/book.svg?raw';
import studentReg from '@phosphor-icons/core/assets/regular/student.svg?raw';
import targetReg from '@phosphor-icons/core/assets/regular/target.svg?raw';
import funnelReg from '@phosphor-icons/core/assets/regular/funnel.svg?raw';
import arrowsClockwiseReg from '@phosphor-icons/core/assets/regular/arrows-clockwise.svg?raw';
import warningReg from '@phosphor-icons/core/assets/regular/warning.svg?raw';
import warningCircleReg from '@phosphor-icons/core/assets/regular/warning-circle.svg?raw';
import shieldReg from '@phosphor-icons/core/assets/regular/shield.svg?raw';
import keyReg from '@phosphor-icons/core/assets/regular/key.svg?raw';
import linkReg from '@phosphor-icons/core/assets/regular/link.svg?raw';
import pulseReg from '@phosphor-icons/core/assets/regular/pulse.svg?raw';
import timerReg from '@phosphor-icons/core/assets/regular/timer.svg?raw';
import hourglassReg from '@phosphor-icons/core/assets/regular/hourglass.svg?raw';
import trendDownReg from '@phosphor-icons/core/assets/regular/trend-down.svg?raw';
import trendUpReg from '@phosphor-icons/core/assets/regular/trend-up.svg?raw';
import chartPieReg from '@phosphor-icons/core/assets/regular/chart-pie.svg?raw';
import chartBarReg from '@phosphor-icons/core/assets/regular/chart-bar.svg?raw';
import buildingsReg from '@phosphor-icons/core/assets/regular/buildings.svg?raw';
import houseReg from '@phosphor-icons/core/assets/regular/house.svg?raw';
import trashReg from '@phosphor-icons/core/assets/regular/trash.svg?raw';
import pencilSimpleReg from '@phosphor-icons/core/assets/regular/pencil-simple.svg?raw';
import checkCircleReg from '@phosphor-icons/core/assets/regular/check-circle.svg?raw';
import xCircleReg from '@phosphor-icons/core/assets/regular/x-circle.svg?raw';
import infoReg from '@phosphor-icons/core/assets/regular/info.svg?raw';
import questionReg from '@phosphor-icons/core/assets/regular/question.svg?raw';
import tableReg from '@phosphor-icons/core/assets/regular/table.svg?raw';
import columnsReg from '@phosphor-icons/core/assets/regular/columns.svg?raw';
import scalesReg from '@phosphor-icons/core/assets/regular/scales.svg?raw';
import stepsReg from '@phosphor-icons/core/assets/regular/steps.svg?raw';
import treeStructureReg from '@phosphor-icons/core/assets/regular/tree-structure.svg?raw';
import graphReg from '@phosphor-icons/core/assets/regular/graph.svg?raw';
import tabsReg from '@phosphor-icons/core/assets/regular/tabs.svg?raw';
import listReg from '@phosphor-icons/core/assets/regular/list.svg?raw';
import plusReg from '@phosphor-icons/core/assets/regular/plus.svg?raw';
import minusReg from '@phosphor-icons/core/assets/regular/minus.svg?raw';
import boundingBoxReg from '@phosphor-icons/core/assets/regular/bounding-box.svg?raw';

export const CARD_TYPE_DUOTONE: Record<UIType, string> = {
  flow: flowDuo,
  stepper: stepperDuo,
  table: tableDuo,
  compare: compareDuo,
  quiz: quizDuo,
  chart: chartDuo,
  mermaid: mermaidDuo,
  callout: calloutDuo,
  stats: statsDuo,
  tabs: tabsDuo,
  timeline: timelineDuo,
  followups: followupsDuo,
  math: functionDuo,
  code: codeBlockDuo,
  checklist: listReg,
  form: listReg,
  generic: listReg,
};

export const REGULAR_ICON_MAP: Record<string, string> = {
  'export': exportReg,
  'download': downloadSimpleReg,
  'download-simple': downloadSimpleReg,
  'image': imageReg,
  'copy': copyReg,
  'code': codeReg,
  'corners-out': cornersOutReg,
  'maximize': cornersOutReg,
  'maximize-2': cornersOutReg,
  'expand': cornersOutReg,
  'corners-in': cornersInReg,
  'minimize': cornersInReg,
  'x': xReg,
  'check': checkReg,
  'caret-down': caretDownReg,
  'chevron-down': caretDownReg,
  'caret-up': caretUpReg,
  'chevron-up': caretUpReg,
  'caret-left': caretLeftReg,
  'chevron-left': caretLeftReg,
  'caret-right': caretRightReg,
  'chevron-right': caretRightReg,
  'arrow-right': arrowRightReg,
  'arrow-left': arrowLeftReg,
  'arrow-up-right': arrowUpRightReg,
  'arrow-ne': arrowUpRightReg,
  'arrow-square-out': arrowSquareOutReg,
  'external-link': arrowSquareOutReg,
  'robot': robotReg,
  'bot': robotReg,
  'sparkle': sparkleReg,
  'sparkles': sparkleReg,
  'shield-check': shieldCheckReg,
  'eye': eyeReg,
  'play': playReg,
  'globe': globeReg,
  'lock': lockReg,
  'server': hardDrivesReg,
  'hard-drives': hardDrivesReg,
  'database': databaseReg,
  'lightning': lightningReg,
  'zap': lightningReg,
  'rocket': rocketReg,
  'clock': clockReg,
  'users': usersReg,
  'user': userReg,
  'cloud': cloudReg,
  'chart-line': chartLineReg,
  'trending-up': trendUpReg,
  'cpu': cpuReg,
  'wifi-high': wifiHighReg,
  'wifi': wifiHighReg,
  'bell': bellReg,
  'calendar': calendarReg,
  'envelope': envelopeReg,
  'mail': envelopeReg,
  'chat-circle': chatCircleReg,
  'message': chatCircleReg,
  'chats-circle': chatsCircleReg,
  'heart': heartReg,
  'star': starReg,
  'magnifying-glass': magnifyingGlassReg,
  'search': magnifyingGlassReg,
  'gear': gearReg,
  'settings': gearReg,
  'file-text': fileTextReg,
  'file': fileTextReg,
  'folder': folderReg,
  'terminal': terminalReg,
  'tag': tagReg,
  'compass': compassReg,
  'map-pin': mapPinReg,
  'credit-card': creditCardReg,
  'wallet': walletReg,
  'shopping-cart': shoppingCartReg,
  'cart': shoppingCartReg,
  'package': packageReg,
  'cube': cubeReg,
  'box': cubeReg,
  'hard-drive': hardDriveReg,
  'laptop': laptopReg,
  'desktop': desktopReg,
  'monitor': desktopReg,
  'device-mobile': deviceMobileReg,
  'smartphone': deviceMobileReg,
  'camera': cameraReg,
  'video': videoReg,
  'music-note': musicNoteReg,
  'book': bookReg,
  'student': studentReg,
  'graduation-cap': studentReg,
  'target': targetReg,
  'funnel': funnelReg,
  'filter': funnelReg,
  'arrows-clockwise': arrowsClockwiseReg,
  'refresh': arrowsClockwiseReg,
  'refresh-cw': arrowsClockwiseReg,
  'warning': warningReg,
  'warning-circle': warningCircleReg,
  'alert-triangle': warningReg,
  'shield': shieldReg,
  'key': keyReg,
  'link': linkReg,
  'activity': pulseReg,
  'pulse': pulseReg,
  'timer': timerReg,
  'hourglass': hourglassReg,
  'trend-down': trendDownReg,
  'trend-up': trendUpReg,
  'chart-pie': chartPieReg,
  'pie-chart': chartPieReg,
  'chart-bar': chartBarReg,
  'bar-chart': chartBarReg,
  'chart': chartBarReg,
  'buildings': buildingsReg,
  'building': buildingsReg,
  'house': houseReg,
  'home': houseReg,
  'trash': trashReg,
  'pencil-simple': pencilSimpleReg,
  'edit': pencilSimpleReg,
  'check-circle': checkCircleReg,
  'x-circle': xCircleReg,
  'info': infoReg,
  'question': questionReg,
  'help-circle': questionReg,
  'table': tableReg,
  'columns': columnsReg,
  'scales': scalesReg,
  'scale': scalesReg,
  'steps': stepsReg,
  'tree-structure': treeStructureReg,
  'workflow': treeStructureReg,
  'network': graphReg,
  'graph': graphReg,
  'tabs': tabsReg,
  'layers': tabsReg,
  'list': listReg,
  'plus': plusReg,
  'minus': minusReg,
  'bounding-box': boundingBoxReg,
  'shrink': cornersInReg,
};

/**
 * Common allowlist of ~60 Phosphor icon names allowed for model choice.
 */
export const ALLOWED_ICONS = [
  'globe',
  'lock',
  'server',
  'database',
  'lightning',
  'rocket',
  'clock',
  'users',
  'user',
  'code',
  'cloud',
  'shield-check',
  'shield',
  'chart-line',
  'chart-bar',
  'chart-pie',
  'cpu',
  'wifi-high',
  'bell',
  'calendar',
  'envelope',
  'chat-circle',
  'heart',
  'star',
  'magnifying-glass',
  'gear',
  'file-text',
  'folder',
  'terminal',
  'tag',
  'compass',
  'map-pin',
  'credit-card',
  'wallet',
  'shopping-cart',
  'package',
  'cube',
  'hard-drive',
  'laptop',
  'device-mobile',
  'camera',
  'video',
  'music-note',
  'book',
  'student',
  'target',
  'funnel',
  'arrows-clockwise',
  'warning',
  'key',
  'link',
  'pulse',
  'timer',
  'hourglass',
  'trend-up',
  'trend-down',
  'buildings',
  'house',
  'trash',
  'pencil-simple',
  'check-circle',
  'x-circle',
  'info',
  'question',
] as const;

export const ALLOWED_ICON_NAMES = new Set<string>(ALLOWED_ICONS);

export function isAllowedIcon(name: string | undefined): boolean {
  if (!name) return false;
  const norm = normalizeIconName(name);
  return ALLOWED_ICON_NAMES.has(norm) || norm in REGULAR_ICON_MAP;
}

export function normalizeIconName(name: string | undefined): string {
  if (!name) return '';
  let s = name.trim();
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  s = s.toLowerCase();
  s = s.replace(/[\s_]+/g, '-');
  return s;
}

/**
 * Returns a duotone Phosphor icon for the 12 card types.
 */
export function typeIconEl(type: UIType, size = 16, className?: string): SVGElement {
  const raw = CARD_TYPE_DUOTONE[type] || CARD_TYPE_DUOTONE.flow;
  const svg = parseSvgString(raw, size);
  if (className) svg.setAttribute('class', className);
  return svg;
}

/**
 * Returns a regular Phosphor icon for UI chrome and components.
 */
export function iconEl(name: string | undefined, size = 16, className?: string): SVGElement {
  const norm = normalizeIconName(name);
  const raw = (norm && REGULAR_ICON_MAP[norm]) ? REGULAR_ICON_MAP[norm] : sparkleReg;
  const svg = parseSvgString(raw, size);
  if (className) svg.setAttribute('class', className);
  return svg;
}
