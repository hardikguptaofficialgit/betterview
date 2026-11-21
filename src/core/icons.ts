import type { UIType } from './types';
import { parseSvgString } from './brandIcons';

import activityIcon from 'lucide-static/icons/activity.svg?raw';
import arrowLeftIcon from 'lucide-static/icons/arrow-left.svg?raw';
import arrowRightIcon from 'lucide-static/icons/arrow-right.svg?raw';
import arrowUpRightIcon from 'lucide-static/icons/arrow-up-right.svg?raw';
import bellIcon from 'lucide-static/icons/bell.svg?raw';
import bookOpenIcon from 'lucide-static/icons/book-open.svg?raw';
import botIcon from 'lucide-static/icons/bot.svg?raw';
import boxIcon from 'lucide-static/icons/box.svg?raw';
import building2Icon from 'lucide-static/icons/building-2.svg?raw';
import calendarIcon from 'lucide-static/icons/calendar.svg?raw';
import cameraIcon from 'lucide-static/icons/camera.svg?raw';
import chartColumnIcon from 'lucide-static/icons/chart-column.svg?raw';
import chartNoAxesCombinedIcon from 'lucide-static/icons/chart-no-axes-combined.svg?raw';
import chartPieIcon from 'lucide-static/icons/chart-pie.svg?raw';
import checkIcon from 'lucide-static/icons/check.svg?raw';
import chevronDownIcon from 'lucide-static/icons/chevron-down.svg?raw';
import chevronLeftIcon from 'lucide-static/icons/chevron-left.svg?raw';
import chevronRightIcon from 'lucide-static/icons/chevron-right.svg?raw';
import chevronUpIcon from 'lucide-static/icons/chevron-up.svg?raw';
import circleAlertIcon from 'lucide-static/icons/circle-alert.svg?raw';
import circleCheckIcon from 'lucide-static/icons/circle-check.svg?raw';
import circleHelpIcon from 'lucide-static/icons/circle-help.svg?raw';
import circleXIcon from 'lucide-static/icons/circle-x.svg?raw';
import clockIcon from 'lucide-static/icons/clock.svg?raw';
import cloudIcon from 'lucide-static/icons/cloud.svg?raw';
import codeIcon from 'lucide-static/icons/code.svg?raw';
import columns3Icon from 'lucide-static/icons/columns-3.svg?raw';
import compassIcon from 'lucide-static/icons/compass.svg?raw';
import copyIcon from 'lucide-static/icons/copy.svg?raw';
import cpuIcon from 'lucide-static/icons/cpu.svg?raw';
import creditCardIcon from 'lucide-static/icons/credit-card.svg?raw';
import databaseIcon from 'lucide-static/icons/database.svg?raw';
import downloadIcon from 'lucide-static/icons/download.svg?raw';
import externalLinkIcon from 'lucide-static/icons/external-link.svg?raw';
import eyeIcon from 'lucide-static/icons/eye.svg?raw';
import fileIcon from 'lucide-static/icons/file.svg?raw';
import fileTextIcon from 'lucide-static/icons/file-text.svg?raw';
import filterIcon from 'lucide-static/icons/filter.svg?raw';
import folderIcon from 'lucide-static/icons/folder.svg?raw';
import globeIcon from 'lucide-static/icons/globe.svg?raw';
import graduationCapIcon from 'lucide-static/icons/graduation-cap.svg?raw';
import hardDriveIcon from 'lucide-static/icons/hard-drive.svg?raw';
import heartIcon from 'lucide-static/icons/heart.svg?raw';
import hourglassIcon from 'lucide-static/icons/hourglass.svg?raw';
import houseIcon from 'lucide-static/icons/house.svg?raw';
import imageIcon from 'lucide-static/icons/image.svg?raw';
import infoIcon from 'lucide-static/icons/info.svg?raw';
import keyIcon from 'lucide-static/icons/key.svg?raw';
import laptopIcon from 'lucide-static/icons/laptop.svg?raw';
import layersIcon from 'lucide-static/icons/layers.svg?raw';
import linkIcon from 'lucide-static/icons/link.svg?raw';
import listIcon from 'lucide-static/icons/list.svg?raw';
import listChecksIcon from 'lucide-static/icons/list-checks.svg?raw';
import listOrderedIcon from 'lucide-static/icons/list-ordered.svg?raw';
import lockIcon from 'lucide-static/icons/lock.svg?raw';
import mailIcon from 'lucide-static/icons/mail.svg?raw';
import mapPinIcon from 'lucide-static/icons/map-pin.svg?raw';
import maximizeIcon from 'lucide-static/icons/maximize.svg?raw';
import messageCircleIcon from 'lucide-static/icons/message-circle.svg?raw';
import messagesSquareIcon from 'lucide-static/icons/messages-square.svg?raw';
import minimizeIcon from 'lucide-static/icons/minimize.svg?raw';
import minusIcon from 'lucide-static/icons/minus.svg?raw';
import monitorIcon from 'lucide-static/icons/monitor.svg?raw';
import musicIcon from 'lucide-static/icons/music.svg?raw';
import networkIcon from 'lucide-static/icons/network.svg?raw';
import packageIcon from 'lucide-static/icons/package.svg?raw';
import panelsTopLeftIcon from 'lucide-static/icons/panels-top-left.svg?raw';
import pencilIcon from 'lucide-static/icons/pencil.svg?raw';
import playIcon from 'lucide-static/icons/play.svg?raw';
import plusIcon from 'lucide-static/icons/plus.svg?raw';
import refreshCwIcon from 'lucide-static/icons/refresh-cw.svg?raw';
import rocketIcon from 'lucide-static/icons/rocket.svg?raw';
import scaleIcon from 'lucide-static/icons/scale.svg?raw';
import searchIcon from 'lucide-static/icons/search.svg?raw';
import serverIcon from 'lucide-static/icons/server.svg?raw';
import settingsIcon from 'lucide-static/icons/settings.svg?raw';
import shieldIcon from 'lucide-static/icons/shield.svg?raw';
import shieldCheckIcon from 'lucide-static/icons/shield-check.svg?raw';
import shoppingCartIcon from 'lucide-static/icons/shopping-cart.svg?raw';
import smartphoneIcon from 'lucide-static/icons/smartphone.svg?raw';
import sparklesIcon from 'lucide-static/icons/sparkles.svg?raw';
import squareIcon from 'lucide-static/icons/square.svg?raw';
import squareFunctionIcon from 'lucide-static/icons/square-function.svg?raw';
import starIcon from 'lucide-static/icons/star.svg?raw';
import tableIcon from 'lucide-static/icons/table.svg?raw';
import tagIcon from 'lucide-static/icons/tag.svg?raw';
import targetIcon from 'lucide-static/icons/target.svg?raw';
import terminalIcon from 'lucide-static/icons/terminal.svg?raw';
import timerIcon from 'lucide-static/icons/timer.svg?raw';
import trash2Icon from 'lucide-static/icons/trash-2.svg?raw';
import trendingDownIcon from 'lucide-static/icons/trending-down.svg?raw';
import trendingUpIcon from 'lucide-static/icons/trending-up.svg?raw';
import triangleAlertIcon from 'lucide-static/icons/triangle-alert.svg?raw';
import uploadIcon from 'lucide-static/icons/upload.svg?raw';
import userIcon from 'lucide-static/icons/user.svg?raw';
import usersIcon from 'lucide-static/icons/users.svg?raw';
import videoIcon from 'lucide-static/icons/video.svg?raw';
import walletIcon from 'lucide-static/icons/wallet.svg?raw';
import wifiIcon from 'lucide-static/icons/wifi.svg?raw';
import workflowIcon from 'lucide-static/icons/workflow.svg?raw';
import xIcon from 'lucide-static/icons/x.svg?raw';
import zapIcon from 'lucide-static/icons/zap.svg?raw';

const REGULAR_ICON_MAP: Record<string, string> = {
  'export': uploadIcon,
  'download': downloadIcon,
  'download-simple': downloadIcon,
  'image': imageIcon,
  'copy': copyIcon,
  'code': codeIcon,
  'corners-out': maximizeIcon,
  'maximize': maximizeIcon,
  'maximize-2': maximizeIcon,
  'expand': maximizeIcon,
  'corners-in': minimizeIcon,
  'minimize': minimizeIcon,
  'x': xIcon,
  'check': checkIcon,
  'caret-down': chevronDownIcon,
  'chevron-down': chevronDownIcon,
  'caret-up': chevronUpIcon,
  'chevron-up': chevronUpIcon,
  'caret-left': chevronLeftIcon,
  'chevron-left': chevronLeftIcon,
  'caret-right': chevronRightIcon,
  'chevron-right': chevronRightIcon,
  'arrow-right': arrowRightIcon,
  'arrow-left': arrowLeftIcon,
  'arrow-up-right': arrowUpRightIcon,
  'arrow-ne': arrowUpRightIcon,
  'arrow-square-out': externalLinkIcon,
  'external-link': externalLinkIcon,
  'robot': botIcon,
  'bot': botIcon,
  'sparkle': sparklesIcon,
  'sparkles': sparklesIcon,
  'shield-check': shieldCheckIcon,
  'eye': eyeIcon,
  'play': playIcon,
  'globe': globeIcon,
  'lock': lockIcon,
  'server': serverIcon,
  'hard-drives': serverIcon,
  'database': databaseIcon,
  'lightning': zapIcon,
  'zap': zapIcon,
  'rocket': rocketIcon,
  'clock': clockIcon,
  'users': usersIcon,
  'user': userIcon,
  'cloud': cloudIcon,
  'chart-line': chartNoAxesCombinedIcon,
  'trending-up': trendingUpIcon,
  'cpu': cpuIcon,
  'wifi-high': wifiIcon,
  'wifi': wifiIcon,
  'bell': bellIcon,
  'calendar': calendarIcon,
  'envelope': mailIcon,
  'mail': mailIcon,
  'chat-circle': messageCircleIcon,
  'message': messageCircleIcon,
  'chats-circle': messagesSquareIcon,
  'heart': heartIcon,
  'star': starIcon,
  'magnifying-glass': searchIcon,
  'search': searchIcon,
  'gear': settingsIcon,
  'settings': settingsIcon,
  'file-text': fileTextIcon,
  'file': fileIcon,
  'folder': folderIcon,
  'terminal': terminalIcon,
  'tag': tagIcon,
  'compass': compassIcon,
  'map-pin': mapPinIcon,
  'credit-card': creditCardIcon,
  'wallet': walletIcon,
  'shopping-cart': shoppingCartIcon,
  'cart': shoppingCartIcon,
  'package': packageIcon,
  'cube': boxIcon,
  'box': boxIcon,
  'hard-drive': hardDriveIcon,
  'laptop': laptopIcon,
  'desktop': monitorIcon,
  'monitor': monitorIcon,
  'device-mobile': smartphoneIcon,
  'smartphone': smartphoneIcon,
  'camera': cameraIcon,
  'video': videoIcon,
  'music-note': musicIcon,
  'book': bookOpenIcon,
  'student': graduationCapIcon,
  'graduation-cap': graduationCapIcon,
  'target': targetIcon,
  'funnel': filterIcon,
  'filter': filterIcon,
  'arrows-clockwise': refreshCwIcon,
  'refresh': refreshCwIcon,
  'refresh-cw': refreshCwIcon,
  'warning': triangleAlertIcon,
  'warning-circle': circleAlertIcon,
  'alert-triangle': triangleAlertIcon,
  'shield': shieldIcon,
  'key': keyIcon,
  'link': linkIcon,
  'activity': activityIcon,
  'pulse': activityIcon,
  'timer': timerIcon,
  'hourglass': hourglassIcon,
  'trend-down': trendingDownIcon,
  'trend-up': trendingUpIcon,
  'chart-pie': chartPieIcon,
  'pie-chart': chartPieIcon,
  'chart-bar': chartColumnIcon,
  'bar-chart': chartColumnIcon,
  'chart': chartColumnIcon,
  'buildings': building2Icon,
  'building': building2Icon,
  'house': houseIcon,
  'home': houseIcon,
  'trash': trash2Icon,
  'pencil-simple': pencilIcon,
  'edit': pencilIcon,
  'check-circle': circleCheckIcon,
  'x-circle': circleXIcon,
  'info': infoIcon,
  'question': circleHelpIcon,
  'help-circle': circleHelpIcon,
  'table': tableIcon,
  'columns': columns3Icon,
  'scales': scaleIcon,
  'scale': scaleIcon,
  'steps': listOrderedIcon,
  'tree-structure': workflowIcon,
  'workflow': workflowIcon,
  'network': networkIcon,
  'graph': networkIcon,
  'tabs': panelsTopLeftIcon,
  'layers': layersIcon,
  'list': listIcon,
  'plus': plusIcon,
  'minus': minusIcon,
  'bounding-box': squareIcon,
  'shrink': minimizeIcon,
  'function': squareFunctionIcon,
  'checklist': listChecksIcon,
};

const CARD_TYPE_ICONS: Record<UIType, string> = {
  flow: workflowIcon,
  stepper: listOrderedIcon,
  table: tableIcon,
  compare: scaleIcon,
  quiz: circleHelpIcon,
  chart: chartColumnIcon,
  mermaid: networkIcon,
  callout: infoIcon,
  stats: chartNoAxesCombinedIcon,
  tabs: panelsTopLeftIcon,
  timeline: clockIcon,
  followups: sparklesIcon,
  math: squareFunctionIcon,
  code: codeIcon,
  checklist: listChecksIcon,
  form: listIcon,
  generic: listIcon,
};

export const ALLOWED_ICONS = [
  'export',
  'download',
  'download-simple',
  'image',
  'copy',
  'code',
  'corners-out',
  'maximize',
  'maximize-2',
  'expand',
  'corners-in',
  'minimize',
  'check',
  'caret-down',
  'chevron-down',
  'caret-up',
  'chevron-up',
  'caret-left',
  'chevron-left',
  'caret-right',
  'chevron-right',
  'arrow-right',
  'arrow-left',
  'arrow-up-right',
  'arrow-ne',
  'arrow-square-out',
  'external-link',
  'robot',
  'bot',
  'sparkle',
  'sparkles',
  'shield-check',
  'eye',
  'play',
  'globe',
  'lock',
  'server',
  'hard-drives',
  'database',
  'lightning',
  'zap',
  'rocket',
  'clock',
  'users',
  'user',
  'cloud',
  'chart-line',
  'trending-up',
  'cpu',
  'wifi-high',
  'wifi',
  'bell',
  'calendar',
  'envelope',
  'mail',
  'chat-circle',
  'message',
  'chats-circle',
  'heart',
  'star',
  'magnifying-glass',
  'search',
  'gear',
  'settings',
  'file-text',
  'file',
  'folder',
  'terminal',
  'tag',
  'compass',
  'map-pin',
  'credit-card',
  'wallet',
  'shopping-cart',
  'cart',
  'package',
  'cube',
  'box',
  'hard-drive',
  'laptop',
  'desktop',
  'monitor',
  'device-mobile',
  'smartphone',
  'camera',
  'video',
  'music-note',
  'book',
  'student',
  'graduation-cap',
  'target',
  'funnel',
  'filter',
  'arrows-clockwise',
  'refresh',
  'refresh-cw',
  'warning',
  'warning-circle',
  'alert-triangle',
  'shield',
  'key',
  'link',
  'activity',
  'pulse',
  'timer',
  'hourglass',
  'trend-down',
  'trend-up',
  'chart-pie',
  'pie-chart',
  'chart-bar',
  'bar-chart',
  'chart',
  'buildings',
  'building',
  'house',
  'home',
  'trash',
  'pencil-simple',
  'edit',
  'check-circle',
  'x-circle',
  'info',
  'question',
  'help-circle',
  'table',
  'columns',
  'scales',
  'scale',
  'steps',
  'tree-structure',
  'workflow',
  'network',
  'graph',
  'tabs',
  'layers',
  'list',
  'plus',
  'minus',
  'bounding-box',
  'shrink',
  'function',
  'checklist',
] as const;
export const ALLOWED_ICON_NAMES = new Set<string>(ALLOWED_ICONS);

export function normalizeIconName(name: string | undefined): string {
  if (!name) return '';
  return name.trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[\s_]+/g, '-');
}

export function isAllowedIcon(name: string | undefined): boolean {
  return !!name && normalizeIconName(name) in REGULAR_ICON_MAP;
}

function makeLucideIcon(raw: string, size = 16, className?: string): SVGElement {
  const svg = parseSvgString(raw, size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) svg.setAttribute('class', className);
  return svg;
}

export function typeIconEl(type: UIType, size = 16, className?: string): SVGElement {
  return makeLucideIcon(CARD_TYPE_ICONS[type] || CARD_TYPE_ICONS.flow, size, className);
}

export function iconEl(name: string | undefined, size = 16, className?: string): SVGElement {
  const raw = REGULAR_ICON_MAP[normalizeIconName(name)] || sparklesIcon;
  return makeLucideIcon(raw, size, className);
}
