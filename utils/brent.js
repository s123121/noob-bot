export function brent(f, lowerBound, upperBound, tolerance = 0.001, maxIterations = 500) {
  let a = lowerBound
  let b = upperBound
  let fa = f(a)
  let fb = f(b)

  if (fa * fb > 0) {
    // Root is not bracketed.
    throw new Error(`Root is not bracketed: [${fa}, ${fb}].`)
  }

  if (Math.abs(fa) < Math.abs(fb)) {
    ;[a, b] = [b, a]
    ;[fa, fb] = [fb, fa]
  }

  let c = a
  let fc = fa
  let s = 0
  let d = 0
  let mflag = true
  for (let i = 0; i < maxIterations; i++) {
    // Check if we have succeeded...
    if (fb === 0 || Math.abs(b - a) <= tolerance) {
      // Root found!
      return b
    }

    // Try to use fast/less-reliable methods first...
    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation.
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb))
    } else {
      // Secant method.
      s = b - fb * ((b - a) / (fb - fa))
    }

    // If necessary, fallback to slow/more-reliable method...
    if (
      (s - (3 * a + b) / 4) * (s - b) >= 0 ||
      (mflag && Math.abs(s - b) >= Math.abs(b - c) / 2) ||
      (!mflag && Math.abs(s - b) >= Math.abs(c - d) / 2) ||
      (mflag && Math.abs(b - c) < Math.abs(tolerance)) ||
      (!mflag && Math.abs(c - d) < Math.abs(tolerance))
    ) {
      // Bisection method.
      s = (a + b) / 2
      mflag = true
    } else {
      mflag = false
    }

    d = c
    c = b
    fc = fb

    const fs = f(s)
    if (fa * fs < 0) {
      b = s
      fb = fs
    } else {
      a = s
      fa = fs
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      ;[a, b] = [b, a]
      ;[fa, fb] = [fb, fa]
    }
  }

  // Could not achieve required tolerance within iteration limit.
  throw new Error('Could not achieve required tolerance within iteration limit.')
}

export function uniroot(func, lowerLimit, upperLimit, errorTol, maxIter) {
  var a = lowerLimit,
    b = upperLimit,
    c = a,
    fa = func(a),
    fb = func(b),
    fc = fa,
    s = 0,
    fs = 0,
    tol_act, // Actual tolerance
    new_step, // Step at this iteration
    prev_step, // Distance from the last but one to the last approximation
    p, // Interpolation step is calculated in the form p/q; division is delayed until the last moment
    q

  errorTol = errorTol || 0
  maxIter = maxIter || 1000

  while (maxIter-- > 0) {
    prev_step = b - a

    if (Math.abs(fc) < Math.abs(fb)) {
      // Swap data for b to be the best approximation
      ;(a = b), (b = c), (c = a)
      ;(fa = fb), (fb = fc), (fc = fa)
    }

    tol_act = 1e-15 * Math.abs(b) + errorTol / 2
    new_step = (c - b) / 2

    if (Math.abs(new_step) <= tol_act || fb === 0) {
      return b // Acceptable approx. is found
    }

    // Decide if the interpolation can be tried
    if (Math.abs(prev_step) >= tol_act && Math.abs(fa) > Math.abs(fb)) {
      // If prev_step was large enough and was in true direction, Interpolatiom may be tried
      var t1, cb, t2
      cb = c - b
      if (a === c) {
        // If we have only two distinct points linear interpolation can only be applied
        t1 = fb / fa
        p = cb * t1
        q = 1.0 - t1
      } else {
        // Quadric inverse interpolation
        ;(q = fa / fc), (t1 = fb / fc), (t2 = fb / fa)
        p = t2 * (cb * q * (q - t1) - (b - a) * (t1 - 1))
        q = (q - 1) * (t1 - 1) * (t2 - 1)
      }

      if (p > 0) {
        q = -q // p was calculated with the opposite sign; make p positive
      } else {
        p = -p // and assign possible minus to q
      }

      if (p < 0.75 * cb * q - Math.abs(tol_act * q) / 2 && p < Math.abs((prev_step * q) / 2)) {
        // If (b + p / q) falls in [b,c] and isn't too large it is accepted
        new_step = p / q
      }

      // If p/q is too large then the bissection procedure can reduce [b,c] range to more extent
    }

    if (Math.abs(new_step) < tol_act) {
      // Adjust the step to be not less than tolerance
      new_step = new_step > 0 ? tol_act : -tol_act
    }

    ;(a = b), (fa = fb) // Save the previous approx.
    ;(b += new_step), (fb = func(b)) // Do step to a new approxim.

    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      ;(c = a), (fc = fa) // Adjust c for it to have a sign opposite to that of b
    }
  }
}

export function localMinimum(func, lowerBound, upperBound, tol = 1e-15, maxIter = 500) {
  const phi = (1 + Math.sqrt(5)) / 2 // Golden ratio

  let a = lowerBound
  let b = upperBound
  let c = b - (b - a) / phi
  let d = a + (b - a) / phi

  let iter = 0
  while (Math.abs(c - d) > tol && iter < maxIter) {
    if (func(c) < func(d)) {
      b = d
    } else {
      a = c
    }

    c = b - (b - a) / phi
    d = a + (b - a) / phi

    iter++
  }

  const xmin = (b + a) / 2
  const fmin = func(xmin)

  return { xmin, fmin, iterations: iter }
}

// Example usage
// const func = (x) => x * x + 4 * x + 4 // Example function: f(x) = x^2 + 4x + 4
// const result = localMinimum(func, -10, 10)

// console.log('Local Minimum:', result.xmin)
// console.log('Function Value at Minimum:', result.fmin)
// console.log('Iterations:', result.iterations)

// def _minimize_scalar_bounded(func, bounds, args=(),
//                              xatol=1e-5, maxiter=500, disp=0,
//                              **unknown_options):
//     """
//     Options
//     -------
//     maxiter : int
//         Maximum number of iterations to perform.
//     disp: int, optional
//         If non-zero, print messages.
//             0 : no message printing.
//             1 : non-convergence notification messages only.
//             2 : print a message on convergence too.
//             3 : print iteration results.
//     xatol : float
//         Absolute error in solution `xopt` acceptable for convergence.

//     """
//     _check_unknown_options(unknown_options)
//     maxfun = maxiter
//     # Test bounds are of correct form
//     if len(bounds) != 2:
//         raise ValueError('bounds must have two elements.')
//     x1, x2 = bounds

//     if not (is_finite_scalar(x1) and is_finite_scalar(x2)):
//         raise ValueError("Optimization bounds must be finite scalars.")

//     if x1 > x2:
//         raise ValueError("The lower bound exceeds the upper bound.")

//     flag = 0
//     header = ' Func-count     x          f(x)          Procedure'
//     step = '       initial'

//     sqrt_eps = sqrt(2.2e-16)
//     golden_mean = 0.5 * (3.0 - sqrt(5.0))
//     a, b = x1, x2
//     fulc = a + golden_mean * (b - a)
//     nfc, xf = fulc, fulc
//     rat = e = 0.0
//     x = xf
//     fx = func(x, *args)
//     num = 1
//     fmin_data = (1, xf, fx)
//     fu = np.inf

//     ffulc = fnfc = fx
//     xm = 0.5 * (a + b)
//     tol1 = sqrt_eps * np.abs(xf) + xatol / 3.0
//     tol2 = 2.0 * tol1

//     if disp > 2:
//         print(" ")
//         print(header)
//         print("%5.0f   %12.6g %12.6g %s" % (fmin_data + (step,)))

//     while (np.abs(xf - xm) > (tol2 - 0.5 * (b - a))):
//         golden = 1
//         # Check for parabolic fit
//         if np.abs(e) > tol1:
//             golden = 0
//             r = (xf - nfc) * (fx - ffulc)
//             q = (xf - fulc) * (fx - fnfc)
//             p = (xf - fulc) * q - (xf - nfc) * r
//             q = 2.0 * (q - r)
//             if q > 0.0:
//                 p = -p
//             q = np.abs(q)
//             r = e
//             e = rat

//             # Check for acceptability of parabola
//             if ((np.abs(p) < np.abs(0.5*q*r)) and (p > q*(a - xf)) and
//                     (p < q * (b - xf))):
//                 rat = (p + 0.0) / q
//                 x = xf + rat
//                 step = '       parabolic'

//                 if ((x - a) < tol2) or ((b - x) < tol2):
//                     si = np.sign(xm - xf) + ((xm - xf) == 0)
//                     rat = tol1 * si
//             else:      # do a golden-section step
//                 golden = 1

//         if golden:  # do a golden-section step
//             if xf >= xm:
//                 e = a - xf
//             else:
//                 e = b - xf
//             rat = golden_mean*e
//             step = '       golden'

//         si = np.sign(rat) + (rat == 0)
//         x = xf + si * np.maximum(np.abs(rat), tol1)
//         fu = func(x, *args)
//         num += 1
//         fmin_data = (num, x, fu)
//         if disp > 2:
//             print("%5.0f   %12.6g %12.6g %s" % (fmin_data + (step,)))

//         if fu <= fx:
//             if x >= xf:
//                 a = xf
//             else:
//                 b = xf
//             fulc, ffulc = nfc, fnfc
//             nfc, fnfc = xf, fx
//             xf, fx = x, fu
//         else:
//             if x < xf:
//                 a = x
//             else:
//                 b = x
//             if (fu <= fnfc) or (nfc == xf):
//                 fulc, ffulc = nfc, fnfc
//                 nfc, fnfc = x, fu
//             elif (fu <= ffulc) or (fulc == xf) or (fulc == nfc):
//                 fulc, ffulc = x, fu

//         xm = 0.5 * (a + b)
//         tol1 = sqrt_eps * np.abs(xf) + xatol / 3.0
//         tol2 = 2.0 * tol1

//         if num >= maxfun:
//             flag = 1
//             break

//     if np.isnan(xf) or np.isnan(fx) or np.isnan(fu):
//         flag = 2

//     fval = fx
//     if disp > 0:
//         _endprint(x, flag, fval, maxfun, xatol, disp)

//     result = OptimizeResult(fun=fval, status=flag, success=(flag == 0),
//                             message={0: 'Solution found.',
//                                      1: 'Maximum number of function calls '
//                                         'reached.',
//                                      2: _status_message['nan']}.get(flag, ''),
//                             x=xf, nfev=num, nit=num)

//     return result
