// Componentes base
export { BrandChip, type BrandChipProps } from './components/BrandChip.tsx';
export { Button, type ButtonProps, type ButtonVariant } from './components/Button.tsx';
export { Checkbox, type CheckboxProps } from './components/Checkbox.tsx';
export { type DateParts, DateOfBirthInput, type DateOfBirthInputProps } from './components/DateOfBirthInput.tsx';
export { Icon, type IconProps } from './components/Icon.tsx';
export { LEGAL_COPY, type LegalLink, LegalNotice, type LegalNoticeProps } from './components/LegalNotice.tsx';
export { type Route, RouteCard, type RouteCardProps } from './components/RouteCard.tsx';
export { SealMark, type SealMarkProps } from './components/SealMark.tsx';
export { CODE_STATUS_COPY, type CodeStatus, VerificationSeal, type VerificationSealProps } from './components/VerificationSeal.tsx';
export { BottomNav, type BottomNavProps, type NavTab } from './components/BottomNav.tsx';
export { EnergyMeter, type EnergyMeterProps, formatClock } from './components/EnergyMeter.tsx';
export { InviteCard, type InviteCardProps } from './components/InviteCard.tsx';
export { type Participant, ParticipantList, type ParticipantListProps, type ParticipantStatus } from './components/ParticipantList.tsx';
export { PinInput, type PinInputProps } from './components/PinInput.tsx';
export { QrScannerFrame, type QrScannerFrameProps } from './components/QrScannerFrame.tsx';
export { ScoreCard, type ScoreCardProps, type ScoreKind } from './components/ScoreCard.tsx';
export { type SegmentOption, SegmentedControl, type SegmentedControlProps } from './components/SegmentedControl.tsx';
export { Sheet, type SheetProps } from './components/Sheet.tsx';
export { OfflineBanner, StatusMessage, type StatusKind, type StatusMessageProps } from './components/StatusMessage.tsx';
export { TextField, type TextFieldProps } from './components/TextField.tsx';
export { Toast, type ToastProps, type ToastTone } from './components/Toast.tsx';
export { TopBar, type TopBarProps } from './components/TopBar.tsx';
// Tema en tiempo de ejecución
export { applyCampaignTheme, type CampaignTheme } from './lib/theme.ts';
// Vistas puras (traducidas desde Google Stitch)
export { AgeGateView, type AgeGateViewProps } from './views/AgeGateView.tsx';
export { CodeLandingView, type CodeLandingViewProps } from './views/CodeLandingView.tsx';
export { CreateParcheView, type CreateParcheViewProps, type ParcheMode } from './views/CreateParcheView.tsx';
export { type JoinMethod, JoinParcheView, type JoinParcheViewProps, type ParchePreview } from './views/JoinParcheView.tsx';
export { type ConnectionState, type GameEntry, ParcheRoomView, type ParcheRoomViewProps } from './views/ParcheRoomView.tsx';
