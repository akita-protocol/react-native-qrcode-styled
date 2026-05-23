import React, { memo, useMemo } from 'react';
import { Path } from 'react-native-svg';
import isEqual from 'react-fast-compare';

import { INNER_EYE_SIZE_IN_BITS, OUTER_EYE_SIZE_IN_BITS } from '../constants';

import {
  getInnerEyePathData,
  getOuterEyePathData,
  getPieceLiquidPathData,
  getPieceRoundedSquarePathData,
  getPieceSquarePathData,
  getRoundedInnerEyePathData,
  getRoundedOuterEyePathData,
  convertBorderRadiusMap,
  isCoordsOfInnerEyes,
  isCoordsOfOuterEyes,
  isLiquidPieceInEyes,
  transformBorderRadiusToArray,
} from '../helpers';
import type {
  BitMatrix,
  PieceOptions,
  EyePosition,
  RenderCustomPieceItem,
  AllEyesOptions,
  LogoArea,
  MultiValue,
} from '../types';

interface SVGPiecesProps extends PieceOptions {
  qrSize: number;
  bitMatrix: BitMatrix;
  pieceLiquidRadius?: MultiValue;
  outerEyesOptions?: AllEyesOptions;
  innerEyesOptions?: AllEyesOptions;
  isPiecesGlued?: boolean;
  renderCustomPieceItem?: RenderCustomPieceItem;
  logoArea?: LogoArea;
  optimizeStyleUpdates?: boolean;
}

type PieceCoord = {
  x: number;
  y: number;
};

type OptimizedBodyPiecesProps = Pick<
  SVGPiecesProps,
  | 'bitMatrix'
  | 'color'
  | 'gradient'
  | 'logoArea'
  | 'pieceBorderRadius'
  | 'pieceCornerType'
  | 'pieceScale'
  | 'pieceSize'
  | 'pieceStroke'
  | 'pieceStrokeWidth'
> & {
  hasInnerEyesOptions?: boolean;
  hasOuterEyesOptions?: boolean;
};

type OptimizedEyePiecesProps = Pick<
  SVGPiecesProps,
  'bitMatrix' | 'innerEyesOptions' | 'outerEyesOptions' | 'pieceSize' | 'qrSize'
>;

function isSupportedOptimizedScale(pieceScale: SVGPiecesProps['pieceScale']): pieceScale is number {
  return pieceScale === undefined || typeof pieceScale === 'number';
}

function getScaledPiecePathData({
  x,
  y,
  pieceSize,
  pieceScale,
  pieceBorderRadius,
  pieceCornerType,
}: {
  x: number;
  y: number;
  pieceSize: number;
  pieceScale?: number;
  pieceBorderRadius?: MultiValue[];
  pieceCornerType?: SVGPiecesProps['pieceCornerType'];
}) {
  const scale = pieceScale ?? 1;
  const scaledSize = pieceSize * scale;
  const inset = (pieceSize - scaledSize) / 2;
  const _x = x * pieceSize + inset;
  const _y = y * pieceSize + inset;

  if (!pieceBorderRadius) {
    return `
      M${_x} ${_y}
      ${_x + scaledSize} ${_y}
      ${_x + scaledSize} ${_y + scaledSize}
      ${_x} ${_y + scaledSize}
      z
    `;
  }

  const [topLeftR = 0, topRightR = 0, bottomRightR = 0, bottomLeftR = 0] = convertBorderRadiusMap(
    pieceBorderRadius,
    pieceSize
  ).map((radius) => radius * scale);
  const isCornerTypeCut = pieceCornerType === 'cut';
  const generateArcStart = (cornerPosition: number) =>
    isCornerTypeCut ? 'L' : `A${cornerPosition} ${cornerPosition} 0 0 1`;

  return `
    M${_x} ${_y + topLeftR}
    ${generateArcStart(topLeftR)} ${_x + topLeftR} ${_y}
    L${_x + scaledSize - topRightR} ${_y}
    ${generateArcStart(topRightR)} ${_x + scaledSize} ${_y + topRightR}
    L${_x + scaledSize} ${_y + scaledSize - bottomRightR}
    ${generateArcStart(bottomRightR)} ${_x + scaledSize - bottomRightR} ${_y + scaledSize}
    L${_x + bottomLeftR} ${_y + scaledSize}
    ${generateArcStart(bottomLeftR)} ${_x} ${_y + scaledSize - bottomLeftR}
    z
  `;
}

function isPieceInLogoArea(x: number, y: number, pieceSize: number, logoArea?: LogoArea): boolean {
  if (!logoArea) {
    return false;
  }

  const _x = x * pieceSize;
  const _y = y * pieceSize;

  return (
    logoArea.x < _x + pieceSize &&
    logoArea.x + logoArea.width > _x &&
    logoArea.y < _y + pieceSize &&
    logoArea.y + logoArea.height > _y
  );
}

function OptimizedBodyPiecesImpl({
  bitMatrix,
  color,
  gradient,
  hasInnerEyesOptions,
  hasOuterEyesOptions,
  logoArea,
  pieceBorderRadius,
  pieceCornerType,
  pieceScale,
  pieceSize,
  pieceStroke,
  pieceStrokeWidth,
}: OptimizedBodyPiecesProps) {
  const numericPieceScale = typeof pieceScale === 'number' ? pieceScale : undefined;
  const transformedPieceBorderRadius = useMemo(
    () => transformBorderRadiusToArray(pieceBorderRadius),
    [pieceBorderRadius]
  );
  const pieces = useMemo<PieceCoord[]>(() => {
    const result: PieceCoord[] = [];

    for (let y = 0; y < bitMatrix.length; y++) {
      for (let x = 0; x < bitMatrix.length; x++) {
        if (isPieceInLogoArea(x, y, pieceSize, logoArea)) {
          continue;
        }

        if (bitMatrix[y]?.[x] !== 1) {
          continue;
        }

        if (
          (hasOuterEyesOptions || hasInnerEyesOptions) &&
          ((hasOuterEyesOptions &&
            !hasInnerEyesOptions &&
            isCoordsOfOuterEyes(x, y, bitMatrix.length)) ||
            (!hasOuterEyesOptions &&
              hasInnerEyesOptions &&
              isCoordsOfInnerEyes(x, y, bitMatrix.length)) ||
            (hasInnerEyesOptions &&
              isCoordsOfInnerEyes(x, y, bitMatrix.length) &&
              hasOuterEyesOptions) ||
            (hasOuterEyesOptions &&
              isCoordsOfOuterEyes(x, y, bitMatrix.length) &&
              hasInnerEyesOptions))
        ) {
          continue;
        }

        result.push({ x, y });
      }
    }

    return result;
  }, [bitMatrix, hasInnerEyesOptions, hasOuterEyesOptions, logoArea, pieceSize]);

  const pathData = useMemo(
    () =>
      pieces
        .map(({ x, y }) =>
          getScaledPiecePathData({
            x,
            y,
            pieceSize,
            pieceScale: numericPieceScale,
            pieceBorderRadius: transformedPieceBorderRadius,
            pieceCornerType,
          })
        )
        .join(' '),
    [numericPieceScale, pieceCornerType, pieceSize, pieces, transformedPieceBorderRadius]
  );

  return (
    <Path
      d={pathData}
      fill={gradient ? 'url(#gradient)' : color}
      stroke={pieceStroke}
      strokeWidth={pieceStrokeWidth}
    />
  );
}

const OptimizedBodyPieces = memo(OptimizedBodyPiecesImpl, isEqual);

function OptimizedEyePiecesImpl({
  bitMatrix,
  innerEyesOptions,
  outerEyesOptions,
  pieceSize,
  qrSize,
}: OptimizedEyePiecesProps) {
  const svgPiecesMatrix: React.ReactElement[] = [];

  if (outerEyesOptions) {
    const listPositions: EyePosition[] = ['topLeft', 'topRight', 'bottomLeft'];
    const origins = {
      topLeft: `${(pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
      topRight: `${qrSize - (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
      bottomLeft: `${(pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        qrSize - (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
    };

    listPositions.forEach((position) => {
      let d = getOuterEyePathData(position, pieceSize, qrSize);

      if (Object.keys(outerEyesOptions).includes(position)) {
        const transformedOuterEyeBorderRadius = transformBorderRadiusToArray(
          outerEyesOptions[position]?.borderRadius
        );

        if (transformedOuterEyeBorderRadius) {
          d = getRoundedOuterEyePathData(
            position,
            transformedOuterEyeBorderRadius,
            pieceSize,
            bitMatrix.length * pieceSize
          );
        }
      }

      svgPiecesMatrix.push(
        <Path
          fill={
            outerEyesOptions?.[position]?.gradient
              ? `url(#${position}OuterEyeGradient)`
              : outerEyesOptions?.[position]?.color || undefined
          }
          fillRule="evenodd"
          stroke={outerEyesOptions?.[position]?.stroke}
          strokeWidth={outerEyesOptions?.[position]?.strokeWidth}
          scale={outerEyesOptions?.[position]?.scale}
          rotation={outerEyesOptions?.[position]?.rotation}
          origin={origins[position]}
          key={`${position}OuterEye`}
          d={d}
        />
      );
    });
  }

  if (innerEyesOptions) {
    const listPositions: EyePosition[] = ['topLeft', 'topRight', 'bottomLeft'];
    const origins = {
      topLeft: `${pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
      topRight: `${qrSize - pieceSize * 2 - (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
      bottomLeft: `${pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        qrSize - pieceSize * 2 - (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
    };

    listPositions.forEach((position) => {
      let d = getInnerEyePathData(position, pieceSize, bitMatrix.length * pieceSize);

      if (Object.keys(innerEyesOptions).includes(position)) {
        const transformedInnerEyeBorderRadius = transformBorderRadiusToArray(
          innerEyesOptions[position]?.borderRadius
        );

        if (transformedInnerEyeBorderRadius) {
          d = getRoundedInnerEyePathData(
            position,
            transformedInnerEyeBorderRadius,
            pieceSize,
            bitMatrix.length * pieceSize
          );
        }
      }

      svgPiecesMatrix.push(
        <Path
          fill={
            innerEyesOptions?.[position]?.gradient
              ? `url(#${position}InnerEyeGradient)`
              : innerEyesOptions?.[position]?.color || undefined
          }
          stroke={innerEyesOptions?.[position]?.stroke}
          strokeWidth={innerEyesOptions?.[position]?.strokeWidth}
          scale={innerEyesOptions?.[position]?.scale}
          rotation={innerEyesOptions?.[position]?.rotation}
          origin={origins[position]}
          key={`${position}InnerEye`}
          d={d}
        />
      );
    });
  }

  return <>{svgPiecesMatrix}</>;
}

const OptimizedEyePieces = memo(OptimizedEyePiecesImpl, isEqual);

function SVGPiecesImpl({
  qrSize,
  bitMatrix,
  pieceLiquidRadius = 0,
  pieceBorderRadius,
  pieceSize,
  pieceCornerType,
  pieceScale,
  pieceRotation,
  pieceStroke,
  pieceStrokeWidth,
  color,
  gradient,
  outerEyesOptions,
  innerEyesOptions,
  isPiecesGlued = false,
  renderCustomPieceItem,
  logoArea,
  optimizeStyleUpdates = false,
}: SVGPiecesProps) {
  if (!bitMatrix || !bitMatrix[0]) {
    return null;
  }

  const canUseOptimizedRenderer =
    optimizeStyleUpdates &&
    !renderCustomPieceItem &&
    !pieceLiquidRadius &&
    !isPiecesGlued &&
    !pieceRotation &&
    isSupportedOptimizedScale(pieceScale);

  if (canUseOptimizedRenderer) {
    return (
      <>
        <OptimizedBodyPieces
          bitMatrix={bitMatrix}
          color={color}
          gradient={gradient}
          hasInnerEyesOptions={!!innerEyesOptions}
          hasOuterEyesOptions={!!outerEyesOptions}
          logoArea={logoArea}
          pieceBorderRadius={pieceBorderRadius}
          pieceCornerType={pieceCornerType}
          pieceScale={pieceScale}
          pieceSize={pieceSize}
          pieceStroke={pieceStroke}
          pieceStrokeWidth={pieceStrokeWidth}
        />
        <OptimizedEyePieces
          bitMatrix={bitMatrix}
          innerEyesOptions={innerEyesOptions}
          outerEyesOptions={outerEyesOptions}
          pieceSize={pieceSize}
          qrSize={qrSize}
        />
      </>
    );
  }

  const svgPiecesMatrix: React.ReactElement[] = [];

  if (renderCustomPieceItem) {
    for (let y = 0; y < bitMatrix.length; y++) {
      for (let x = 0; x < bitMatrix.length; x++) {
        const PieceElement = renderCustomPieceItem({ x, y, pieceSize, qrSize, bitMatrix });

        if (PieceElement) {
          svgPiecesMatrix.push(PieceElement);
        }
      }
    }

    return <>{svgPiecesMatrix}</>;
  }

  const transformedPieceBorderRadius = transformBorderRadiusToArray(pieceBorderRadius);

  for (let y = 0; y < bitMatrix.length; y++) {
    for (let x = 0; x < bitMatrix.length; x++) {
      // Not showing any shapes overlapping with logo if QR has it
      if (logoArea) {
        const _x = x * pieceSize;
        const _y = y * pieceSize;
        if (
          logoArea.x < _x + pieceSize &&
          logoArea.x + logoArea.width > _x &&
          logoArea.y < _y + pieceSize &&
          logoArea.y + logoArea.height > _y
        ) {
          continue;
        }
      }

      if (bitMatrix[y]?.[x] === 1) {
        const origin = `
          ${x * pieceSize + pieceSize / 2},
          ${y * pieceSize + pieceSize / 2}`;

        let d = getPieceSquarePathData(x, y, pieceSize);

        if (transformedPieceBorderRadius) {
          d = getPieceRoundedSquarePathData({
            x,
            y,
            size: pieceSize,
            cornerType: pieceCornerType,
            borderRadius: transformedPieceBorderRadius,
            isGlued: isPiecesGlued,
            isLiquid: !!pieceLiquidRadius,
            bitMatrix,
          });
        }

        let PathComponent = (
          <Path
            scale={pieceScale}
            rotation={pieceRotation}
            origin={origin}
            stroke={pieceStroke}
            strokeWidth={pieceStrokeWidth}
            key={`${x}_${y}`}
            d={d}
          />
        );

        // not showing pieces if cornerSquaresOptions | cornerDotsOptions exist
        if (outerEyesOptions || innerEyesOptions) {
          if (
            (outerEyesOptions &&
              !innerEyesOptions &&
              !isCoordsOfOuterEyes(x, y, bitMatrix.length)) ||
            (!outerEyesOptions &&
              innerEyesOptions &&
              !isCoordsOfInnerEyes(x, y, bitMatrix.length)) ||
            (innerEyesOptions &&
              !isCoordsOfInnerEyes(x, y, bitMatrix.length) &&
              outerEyesOptions &&
              !isCoordsOfOuterEyes(x, y, bitMatrix.length))
          ) {
            svgPiecesMatrix.push(PathComponent);
          }
        } else {
          svgPiecesMatrix.push(PathComponent);
        }
      } else {
        // adding liquid between bits in empty places
        if (pieceLiquidRadius) {
          if (
            (outerEyesOptions && !isLiquidPieceInEyes(x, y, bitMatrix.length)) ||
            !outerEyesOptions
          ) {
            const d = getPieceLiquidPathData(x, y, pieceSize, pieceLiquidRadius);
            const origin = `
            ${x * pieceSize + pieceSize / 2},
            ${y * pieceSize + pieceSize / 2}`;

            if (bitMatrix[y]?.[x - 1] === 1 && bitMatrix[y - 1]?.[x] === 1) {
              svgPiecesMatrix.push(<Path key={`${x}_${y}_topLeft`} d={d} />);
            }

            if (bitMatrix[y]?.[x - 1] === 1 && bitMatrix[y + 1]?.[x] === 1) {
              svgPiecesMatrix.push(
                <Path rotation={-90} origin={origin} key={`${x}_${y}_topRight`} d={d} />
              );
            }

            if (bitMatrix[y]?.[x + 1] === 1 && bitMatrix[y - 1]?.[x] === 1) {
              svgPiecesMatrix.push(
                <Path rotation={90} origin={origin} key={`${x}_${y}_bottomRight`} d={d} />
              );
            }

            if (bitMatrix[y]?.[x + 1] === 1 && bitMatrix[y + 1]?.[x] === 1) {
              svgPiecesMatrix.push(
                <Path rotation={180} origin={origin} key={`${x}_${y}_bottomLeft`} d={d} />
              );
            }
          }
        }
      }
    }
  }

  // adding custom corner squares if options is exist
  if (outerEyesOptions) {
    const listPositions: EyePosition[] = ['topLeft', 'topRight', 'bottomLeft'];
    const origins = {
      topLeft: `${(pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
      topRight: `${qrSize - (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
      bottomLeft: `${(pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2}, ${
        qrSize - (pieceSize * OUTER_EYE_SIZE_IN_BITS) / 2
      }`,
    };

    listPositions.forEach((position) => {
      let d = getOuterEyePathData(position, pieceSize, qrSize);

      if (Object.keys(outerEyesOptions).includes(position)) {
        const transformedOuterEyeBorderRadius = transformBorderRadiusToArray(
          outerEyesOptions[position]?.borderRadius
        );

        if (transformedOuterEyeBorderRadius) {
          d = getRoundedOuterEyePathData(
            position,
            transformedOuterEyeBorderRadius,
            pieceSize,
            bitMatrix.length * pieceSize
          );
        }
      }

      svgPiecesMatrix.push(
        <Path
          fill={
            outerEyesOptions?.[position]?.gradient
              ? `url(#${position}OuterEyeGradient)`
              : outerEyesOptions?.[position]?.color || undefined
          }
          fillRule="evenodd"
          stroke={outerEyesOptions?.[position]?.stroke}
          strokeWidth={outerEyesOptions?.[position]?.strokeWidth}
          scale={outerEyesOptions?.[position]?.scale}
          rotation={outerEyesOptions?.[position]?.rotation}
          origin={origins[position]}
          key={`${position}OuterEye`}
          d={d}
        />
      );
    });
  }

  // adding custom corner dots if options is exist
  if (innerEyesOptions) {
    const listPositions: EyePosition[] = ['topLeft', 'topRight', 'bottomLeft'];
    const origins = {
      topLeft: `${pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
      topRight: `${qrSize - pieceSize * 2 - (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
      bottomLeft: `${pieceSize * 2 + (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2}, ${
        qrSize - pieceSize * 2 - (pieceSize * INNER_EYE_SIZE_IN_BITS) / 2
      }`,
    };

    listPositions.forEach((position) => {
      let d = getInnerEyePathData(position, pieceSize, bitMatrix.length * pieceSize);

      if (Object.keys(innerEyesOptions).includes(position)) {
        const transformedInnerEyeBorderRadius = transformBorderRadiusToArray(
          innerEyesOptions[position]?.borderRadius
        );

        if (transformedInnerEyeBorderRadius) {
          d = getRoundedInnerEyePathData(
            position,
            transformedInnerEyeBorderRadius,
            pieceSize,
            bitMatrix.length * pieceSize
          );
        }
      }

      svgPiecesMatrix.push(
        <Path
          fill={
            innerEyesOptions?.[position]?.gradient
              ? `url(#${position}InnerEyeGradient)`
              : innerEyesOptions?.[position]?.color || undefined
          }
          stroke={innerEyesOptions?.[position]?.stroke}
          strokeWidth={innerEyesOptions?.[position]?.strokeWidth}
          scale={innerEyesOptions?.[position]?.scale}
          rotation={innerEyesOptions?.[position]?.rotation}
          origin={origins[position]}
          key={`${position}InnerEye`}
          d={d}
        />
      );
    });
  }

  return <>{svgPiecesMatrix}</>;
}

export default memo(SVGPiecesImpl, isEqual);
