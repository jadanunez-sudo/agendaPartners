
// =============================================
// ESCUELA DE MANEJO PARTNERS
// AGENDA VIRTUAL COMPARTIDA CON FIREBASE
// HORARIO: 07:00 A 18:00
// =============================================

// CONEXIÓN FIREBASE
import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    collection,
    doc,
    onSnapshot,
    runTransaction
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

// =============================================
// CONFIGURACIÓN GENERAL
// =============================================

const $ = id => document.getElementById(id);

const HORA_APERTURA = 7 * 60;
const HORA_CIERRE = 18 * 60;

let reservas = [];
let usuarioActual = null;
let detenerEscucha = null;
let datosListos = false;

function fechaLocal(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;
}

let fechaActual = fechaLocal(new Date());

let mesVisible = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

function mostrarFecha(fecha) {
    const [a, m, d] = fecha.split("-").map(Number);

    return new Date(a, m - 1, d)
        .toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
}

function minutos(hora) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function horaFinal(hora, duracion) {
    const total = minutos(hora) + Number(duracion);

    const h = String(
        Math.floor(total / 60)
    ).padStart(2, "0");

    const m = String(
        total % 60
    ).padStart(2, "0");

    return `${h}:${m}`;
}

// Cada documento guarda las clases
// de un instructor en una fecha.

function documentoHorario(fecha, instructor) {
    const identificador =
        fecha + "_" + encodeURIComponent(instructor);

    return doc(db, "reservas", identificador);
}

function mostrarMensaje(texto, esError = false) {
    const aviso = $("mensajeFormulario");

    aviso.textContent = texto;
    aviso.className = "mensaje-formulario";

    aviso.classList.add(
        esError ? "error" : "exito"
    );
}

// =============================================
// INICIO DE SESIÓN DE ASESORES
// =============================================

$("formularioLogin").addEventListener(
    "submit",
    async evento => {
        evento.preventDefault();

        const correo = $("correoLogin").value.trim();
        const clave = $("claveLogin").value;

        $("errorLogin").textContent = "";

        try {
            await signInWithEmailAndPassword(
                auth,
                correo,
                clave
            );

            $("claveLogin").value = "";

        } catch (error) {
            console.error("Error de acceso:", error);

            $("errorLogin").textContent =
                "No se pudo iniciar sesión. " +
                "Verifica tu correo y contraseña.";
        }
    }
);

$("cerrarSesion").addEventListener(
    "click",
    async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error(error);
            alert("No se pudo cerrar sesión.");
        }
    }
);

// =============================================
// CARGAR RESERVAS COMPARTIDAS
// =============================================

onAuthStateChanged(auth, usuario => {

    if (detenerEscucha) {
        detenerEscucha();
        detenerEscucha = null;
    }

    usuarioActual = usuario;
    reservas = [];
    datosListos = false;

    $("pantallaLogin").hidden = !!usuario;
    $("aplicacionPartners").hidden = !usuario;

    if (!usuario) {
        actualizarPantalla();
        return;
    }

    $("tablaReservas").replaceChildren();

    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = 6;
    celda.textContent =
        "Cargando programaciones de Firebase...";

    fila.appendChild(celda);
    $("tablaReservas").appendChild(fila);

    // Sincronización en tiempo real
    detenerEscucha = onSnapshot(
        collection(db, "reservas"),

        resultado => {
            reservas = [];

            resultado.forEach(documento => {
                const datos = documento.data();

                if (Array.isArray(datos.clases)) {
                    reservas.push(...datos.clases);
                }
            });

            datosListos = true;
            actualizarPantalla();
        },

        error => {
            console.error(
                "Error al consultar Firestore:",
                error
            );

            datosListos = false;
            $("tablaReservas").replaceChildren();

            const filaError =
                document.createElement("tr");

            const celdaError =
                document.createElement("td");

            celdaError.colSpan = 6;
            celdaError.textContent =
                "Error al cargar las reservas. " +
                "Revisa Firebase y sus permisos.";

            filaError.appendChild(celdaError);
            $("tablaReservas").appendChild(filaError);

            actualizarEstadisticas();
            dibujarCalendario();

            alert(
                "No se pudieron cargar las programaciones. " +
                "Revisa tu conexión o las reglas de Firestore."
            );
        }
    );
});

// =============================================
// CALENDARIO DE CLASES
// =============================================

function dibujarCalendario() {

    const contenedor = $("diasCalendario");
    contenedor.replaceChildren();

    const anio = mesVisible.getFullYear();
    const mes = mesVisible.getMonth();

    $("nombreMes").textContent =
        mesVisible.toLocaleDateString("es-PE", {
            month: "long",
            year: "numeric"
        });

    const primerDia = new Date(anio, mes, 1);

    const ultimoDia = new Date(
        anio,
        mes + 1,
        0
    ).getDate();

    // La semana empieza el lunes
    const espacios = (primerDia.getDay() + 6) % 7;

    for (let i = 0; i < espacios; i++) {
        const espacio = document.createElement("span");
        contenedor.appendChild(espacio);
    }

    for (let dia = 1; dia <= ultimoDia; dia++) {

        const fecha = fechaLocal(
            new Date(anio, mes, dia)
        );

        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = "dia";
        boton.textContent = dia;

        if (fecha === fechaActual) {
            boton.classList.add("seleccionado");
        }

        if (reservas.some(r => r.fecha === fecha)) {
            boton.classList.add("con-reserva");
        }

        boton.addEventListener("click", () => {
            fechaActual = fecha;
            $("fecha").value = fecha;
            actualizarPantalla();
        });

        contenedor.appendChild(boton);
    }

    $("fechaSeleccionada").textContent =
        mostrarFecha(fechaActual);
}

// MES ANTERIOR

$("mesAnterior").addEventListener("click", () => {
    mesVisible = new Date(
        mesVisible.getFullYear(),
        mesVisible.getMonth() - 1,
        1
    );

    dibujarCalendario();
});

// MES SIGUIENTE

$("mesSiguiente").addEventListener("click", () => {
    mesVisible = new Date(
        mesVisible.getFullYear(),
        mesVisible.getMonth() + 1,
        1
    );

    dibujarCalendario();
});

// VOLVER A HOY

$("hoyBtn").addEventListener("click", () => {

    const hoy = new Date();

    fechaActual = fechaLocal(hoy);

    mesVisible = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        1
    );

    $("fecha").value = fechaActual;

    actualizarPantalla();
});

// CAMBIO MANUAL DE FECHA

$("fecha").addEventListener("change", () => {

    if (!$("fecha").value) return;

    fechaActual = $("fecha").value;

    const [anio, mes] =
        fechaActual.split("-").map(Number);

    mesVisible = new Date(anio, mes - 1, 1);

    actualizarPantalla();
});

// =============================================
// REGISTRAR ALUMNOS EN FIREBASE
// =============================================

$("formularioReserva").addEventListener(
    "submit",
    async evento => {

        evento.preventDefault();

        if (!usuarioActual) {
            mostrarMensaje(
                "Primero debes iniciar sesión.",
                true
            );
            return;
        }

        if (!datosListos) {
            mostrarMensaje(
                "Espera a que se carguen las reservas.",
                true
            );
            return;
        }

        // Leer los datos del formulario
        const nueva = {

            id: crypto.randomUUID(),

            alumno: $("alumno").value.trim(),

            celular: $("celular").value.trim(),

            servicio: $("servicio").value,

            fecha: $("fecha").value,

            hora: $("hora").value,

            duracion: Number($("duracion").value),

            instructor: $("instructor").value,

            observacion: $("observacion").value.trim(),

            estado: "programada",

            asesorUid: usuarioActual.uid
        };

        // VALIDAR CAMPOS OBLIGATORIOS

        if (
            !nueva.alumno ||
            !nueva.servicio ||
            !nueva.fecha ||
            !nueva.hora ||
            !nueva.instructor
        ) {
            mostrarMensaje(
                "Completa todos los campos obligatorios.",
                true
            );
            return;
        }

        // CELULAR OPCIONAL

        if (
            nueva.celular !== "" &&
            !/^[+0-9()\s-]{7,20}$/.test(nueva.celular)
        ) {
            mostrarMensaje(
                "Ingresa un celular válido o déjalo vacío.",
                true
            );
            return;
        }

        // HORARIO DE ATENCIÓN: 07:00 A 18:00

        const inicio = minutos(nueva.hora);
        const fin = inicio + nueva.duracion;

        if (
            !Number.isFinite(inicio) ||
            !Number.isFinite(fin) ||
            nueva.duracion <= 0 ||
            inicio < HORA_APERTURA ||
            fin > HORA_CIERRE
        ) {
            mostrarMensaje(
                "La clase debe comenzar desde las 07:00 " +
                "y terminar como máximo a las 18:00.",
                true
            );
            return;
        }

        const referencia = documentoHorario(
            nueva.fecha,
            nueva.instructor
        );

        const botonGuardar =
            $("formularioReserva")
                .querySelector('button[type="submit"]');

        botonGuardar.disabled = true;
        botonGuardar.textContent = "Guardando...";

        try {

            // Transacción para evitar cruce de horarios
            await runTransaction(
                db,
                async transaccion => {

                    const documento =
                        await transaccion.get(referencia);

                    const existentes =
                        documento.exists()
                        ? documento.data().clases || []
                        : [];

                    const horarioOcupado =
                        existentes.some(reserva => {

                            const inicioExistente =
                                minutos(reserva.hora);

                            const finExistente =
                                inicioExistente +
                                Number(reserva.duracion);

                            return (
                                inicio < finExistente &&
                                fin > inicioExistente
                            );
                        });

                    if (horarioOcupado) {
                        throw new Error("HORARIO_OCUPADO");
                    }

                    transaccion.set(referencia, {
                        fecha: nueva.fecha,
                        instructor: nueva.instructor,
                        clases: [...existentes, nueva]
                    });
                }
            );

            // Actualizar fecha seleccionada
            fechaActual = nueva.fecha;

            const [a, m] =
                fechaActual.split("-").map(Number);

            mesVisible = new Date(a, m - 1, 1);

            // Limpiar formulario
            $("formularioReserva").reset();

            $("fecha").value = fechaActual;
            $("duracion").value = "60";

            mostrarMensaje(
                "¡Alumno y programación guardados en Firebase!"
            );

            actualizarPantalla();

        } catch (error) {

            console.error(
                "Error guardando programación:",
                error
            );

            if (error.message === "HORARIO_OCUPADO") {
                mostrarMensaje(
                    "Este instructor ya tiene una clase " +
                    "en ese horario.",
                    true
                );
            } else {
                mostrarMensaje(
                    "No se pudo guardar. Revisa la " +
                    "conexión y los permisos de Firebase.",
                    true
                );
            }

        } finally {
            botonGuardar.disabled = false;
            botonGuardar.textContent =
                "Guardar programación";
        }
    }
);

// =============================================
// COMPLETAR O ELIMINAR RESERVA
// =============================================

async function cambiarReserva(reserva, accion) {

    if (!usuarioActual) return;

    const referencia = documentoHorario(
        reserva.fecha,
        reserva.instructor
    );

    try {

        await runTransaction(
            db,
            async transaccion => {

                const documento =
                    await transaccion.get(referencia);

                if (!documento.exists()) {
                    throw new Error("NO_ENCONTRADA");
                }

                let clases =
                    documento.data().clases || [];

                const existe = clases.some(
                    r => r.id === reserva.id
                );

                if (!existe) {
                    throw new Error("NO_ENCONTRADA");
                }

                if (accion === "eliminar") {

                    clases = clases.filter(
                        r => r.id !== reserva.id
                    );

                } else if (accion === "completar") {

                    clases = clases.map(r => {

                        if (r.id === reserva.id) {
                            return {
                                ...r,
                                estado: "completada"
                            };
                        }

                        return r;
                    });
                }

                transaccion.update(referencia, {
                    clases
                });
            }
        );

    } catch (error) {
        console.error(error);

        alert(
            "No se pudo actualizar la programación. " +
            "Revisa la conexión."
        );
    }
}


// =============================================
// PARTNERS - EDITAR PROGRAMACIONES
// GUARDAR MODIFICACIONES EN FIREBASE
// =============================================

function abrirEditor(reserva) {

    // Evitar abrir dos ventanas
    if (document.getElementById("ventanaEditar")) {
        return;
    }

    const ventana = document.createElement("div");
    ventana.id = "ventanaEditar";
    ventana.className = "fondo-editar";

    // Crear formulario de edición
    ventana.innerHTML = `
        <div class="tarjeta-editar">

            <h2>✏️ Editar programación</h2>
            <p>Modifica los datos del alumno.</p>

            <form id="formularioEditar">

                <label for="editarAlumno">
                    Nombre completo
                </label>
                <input id="editarAlumno"
                       type="text"
                       maxlength="100"
                       required>

                <label for="editarCelular">
                    Celular (Opcional)
                </label>
                <input id="editarCelular"
                       type="tel"
                       maxlength="20">

                <label for="editarServicio">
                    Servicio
                </label>
                <select id="editarServicio" required></select>

                <div class="dos-columnas">
                    <div>
                        <label for="editarFecha">Fecha</label>
                        <input id="editarFecha"
                               type="date"
                               required>
                    </div>

                    <div>
                        <label for="editarHora">Hora</label>
                        <select id="editarHora" required></select>
                    </div>
                </div>

                <div class="dos-columnas">
                    <div>
                        <label for="editarDuracion">Duración</label>
                        <select id="editarDuracion" required></select>
                    </div>

                    <div>
                        <label for="editarInstructor">Instructor</label>
                        <select id="editarInstructor" required></select>
                    </div>
                </div>

                <label for="editarObservacion">
                    Observaciones
                </label>
                <textarea id="editarObservacion"
                          rows="3"
                          maxlength="500"></textarea>

                <p id="errorEditar"
                   class="mensaje-formulario"
                   role="status"></p>

                <div class="botones-editar">
                    <button type="button"
                            id="cancelarEditar">
                        Cancelar
                    </button>

                    <button type="submit"
                            id="guardarEdicion">
                        Guardar cambios
                    </button>
                </div>

            </form>
        </div>
    `;

    document.body.appendChild(ventana);

    // Copiar las alternativas actuales
    // del formulario principal
    const campos = [
        ["servicio", "editarServicio"],
        ["hora", "editarHora"],
        ["duracion", "editarDuracion"],
        ["instructor", "editarInstructor"]
    ];

    campos.forEach(([origen, destino]) => {
        $(destino).innerHTML = $(origen).innerHTML;
    });

    // Cargar los datos actuales del alumno
    $("editarAlumno").value = reserva.alumno;
    $("editarCelular").value = reserva.celular || "";
    $("editarServicio").value = reserva.servicio;
    $("editarFecha").value = reserva.fecha;
    $("editarHora").value = reserva.hora;
    $("editarDuracion").value = String(reserva.duracion);
    $("editarInstructor").value = reserva.instructor;
    $("editarObservacion").value =
        reserva.observacion || "";

    // Cancelar sin realizar modificaciones
    $("cancelarEditar").addEventListener("click", () => {
        ventana.remove();
    });

    // Guardar cambios
    $("formularioEditar").addEventListener(
        "submit",
        async evento => {

            evento.preventDefault();

            const aviso = $("errorEditar");
            aviso.textContent = "";
            aviso.className = "mensaje-formulario";

            const actualizado = {
                ...reserva,
                alumno: $("editarAlumno").value.trim(),
                celular: $("editarCelular").value.trim(),
                servicio: $("editarServicio").value,
                fecha: $("editarFecha").value,
                hora: $("editarHora").value,
                duracion: Number($("editarDuracion").value),
                instructor: $("editarInstructor").value,
                observacion: $("editarObservacion").value.trim()
            };

            if (
                !actualizado.alumno ||
                !actualizado.servicio ||
                !actualizado.fecha ||
                !actualizado.hora ||
                !actualizado.instructor
            ) {
                aviso.textContent =
                    "Completa todos los campos obligatorios.";
                aviso.classList.add("error");
                return;
            }

            if (
                actualizado.celular !== "" &&
                !/^[+0-9()\s-]{7,20}$/.test(actualizado.celular)
            ) {
                aviso.textContent =
                    "Ingresa un celular válido.";
                aviso.classList.add("error");
                return;
            }

            const inicio = minutos(actualizado.hora);
            const fin = inicio + actualizado.duracion;

            if (
                !Number.isFinite(inicio) ||
                !Number.isFinite(fin) ||
                actualizado.duracion <= 0 ||
                inicio < HORA_APERTURA ||
                fin > HORA_CIERRE
            ) {
                aviso.textContent =
                    "La clase debe terminar como máximo a las 18:00.";
                aviso.classList.add("error");
                return;
            }

            const boton = $("guardarEdicion");
            boton.disabled = true;
            boton.textContent = "Guardando...";

            // Documento original y documento de destino
            const origen = documentoHorario(
                reserva.fecha,
                reserva.instructor
            );

            const destino = documentoHorario(
                actualizado.fecha,
                actualizado.instructor
            );

            const mismoDocumento =
                origen.path === destino.path;

            try {

                await runTransaction(db, async transaccion => {

                    // Leer los documentos antes de escribir
                    const docOrigen =
                        await transaccion.get(origen);

                    if (!docOrigen.exists()) {
                        throw new Error("NO_EXISTE");
                    }

                    const docDestino = mismoDocumento
                        ? docOrigen
                        : await transaccion.get(destino);

                    const clasesOrigen =
                        docOrigen.data().clases || [];

                    const clasesDestino = mismoDocumento
                        ? clasesOrigen
                        : docDestino.exists()
                            ? docDestino.data().clases || []
                            : [];

                    const original = clasesOrigen.find(
                        r => r.id === reserva.id
                    );

                    if (!original) {
                        throw new Error("NO_EXISTE");
                    }

                    // Revisar horarios ocupados
                    const ocupado = clasesDestino.some(r => {

                        if (r.id === reserva.id) return false;

                        const inicioExistente =
                            minutos(r.hora);

                        const finExistente =
                            inicioExistente +
                            Number(r.duracion);

                        return (
                            inicio < finExistente &&
                            fin > inicioExistente
                        );
                    });

                    if (ocupado) {
                        throw new Error("HORARIO_OCUPADO");
                    }

                    if (mismoDocumento) {

                        // Editar dentro del mismo día e instructor
                        const clasesNuevas = clasesOrigen.map(r =>
                            r.id === reserva.id
                                ? {...original, ...actualizado}
                                : r
                        );

                        transaccion.update(origen, {
                            clases: clasesNuevas
                        });

                    } else {

                        // Quitar la clase de su horario anterior
                        const restantes = clasesOrigen.filter(
                            r => r.id !== reserva.id
                        );

                        transaccion.update(origen, {
                            clases: restantes
                        });

                        // Trasladarla al nuevo día o instructor
                        transaccion.set(destino, {
                            fecha: actualizado.fecha,
                            instructor: actualizado.instructor,
                            clases: [
                                ...clasesDestino,
                                {...original, ...actualizado}
                            ]
                        });
                    }
                });

                // Mostrar la nueva fecha en el calendario
                fechaActual = actualizado.fecha;

                const [anio, mes] =
                    fechaActual.split("-").map(Number);

                mesVisible = new Date(anio, mes - 1, 1);
                $("fecha").value = fechaActual;

                ventana.remove();
                actualizarPantalla();

                alert(
                    "¡Programación actualizada correctamente en Firebase!"
                );

            } catch (error) {

                console.error("Error al editar:", error);

                aviso.textContent =
                    error.message === "HORARIO_OCUPADO"
                        ? "El instructor ya tiene otra clase en ese horario."
                        : error.message === "NO_EXISTE"
                            ? "La reserva ya no existe. Actualiza la agenda."
                            : "No se pudieron guardar los cambios.";

                aviso.classList.add("error");

            } finally {
                boton.disabled = false;
                boton.textContent = "Guardar cambios";
            }
        }
    );
}


// =============================================
// ESTADÍSTICAS
// =============================================

function actualizarEstadisticas() {

    const hoy = fechaLocal(new Date());

    $("clasesHoy").textContent =
        reservas.filter(
            r => r.fecha === hoy
        ).length;

    $("programadas").textContent =
        reservas.filter(
            r => r.estado === "programada"
        ).length;

    $("completadas").textContent =
        reservas.filter(
            r => r.estado === "completada"
        ).length;

    $("totalRegistros").textContent =
        reservas.length;
}

// =============================================
// TABLA DE PROGRAMACIONES
// =============================================

function dibujarTabla() {

    const cuerpo = $("tablaReservas");
    cuerpo.replaceChildren();

    if (usuarioActual && !datosListos) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 7;
        celda.textContent =
            "Cargando datos de Firebase...";

        fila.appendChild(celda);
        cuerpo.appendChild(fila);
        return;
    }

    const filtro = $("filtroEstado").value;

    const lista = reservas
        .filter(r => r.fecha === fechaActual)
        .filter(r =>
            filtro === "todos" ||
            r.estado === filtro
        )
        .sort(
            (a, b) => a.hora.localeCompare(b.hora)
        );

    if (lista.length === 0) {

        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 6;
        celda.textContent =
            "No hay clases registradas para esta fecha.";

        fila.appendChild(celda);
        cuerpo.appendChild(fila);

        return;
    }

    lista.forEach(reserva => {

        const fila = document.createElement("tr");

        function agregarCelda(valor) {
            const celda = document.createElement("td");
            celda.textContent = valor ?? "";
            fila.appendChild(celda);
            return celda;
        }

        // HORARIO
        agregarCelda(
            reserva.hora + " - " +
            horaFinal(reserva.hora, reserva.duracion)
        );

        // ALUMNO
        const celdaAlumno =
            agregarCelda(reserva.alumno);

        if (reserva.celular) {
            const telefono =
                document.createElement("small");

            telefono.textContent = reserva.celular;

            celdaAlumno.appendChild(
                document.createElement("br")
            );

            celdaAlumno.appendChild(telefono);
        }

        agregarCelda(reserva.servicio);
        agregarCelda(reserva.instructor);

        const estado =
            agregarCelda(reserva.estado);

        estado.className = "estado-clase";

        if (reserva.estado === "completada") {
            estado.classList.add("completada");
        }

        // MOSTRAR OBSERVACIONES DEL ALUMNO
        const celdaObservacion = agregarCelda(
            reserva.observacion || "Sin observaciones"
        );

        celdaObservacion.className = "celda-observacion";

        // BOTONES
        const acciones =
            document.createElement("td");

        acciones.className = "acciones";

        if (reserva.estado !== "completada") {

            const completar =
                document.createElement("button");

            completar.type = "button";
            completar.textContent = "Completar";

            completar.addEventListener("click", () => {
                cambiarReserva(reserva, "completar");
            });

            acciones.appendChild(completar);
        }

        const eliminar =
            document.createElement("button");

        eliminar.type = "button";
        eliminar.textContent = "Eliminar";
        eliminar.className = "eliminar";

        eliminar.addEventListener("click", () => {

            const confirmar = confirm(
                "¿Deseas eliminar la programación de " +
                reserva.alumno + "?"
            );

            if (confirmar) {
                cambiarReserva(reserva, "eliminar");
            }
        });

// BOTÓN EDITAR PROGRAMACIÓN
const editar = document.createElement("button");

editar.type = "button";
editar.textContent = "✏️ Editar";
editar.className = "boton-editar";

editar.addEventListener("click", () => {
    abrirEditor(reserva);
});

acciones.appendChild(editar);

        acciones.appendChild(eliminar);

        fila.appendChild(acciones);
        cuerpo.appendChild(fila);
    });
}

$("filtroEstado").addEventListener(
    "change",
    dibujarTabla
);

// =============================================
// EXPORTAR A EXCEL (CSV)
// =============================================

function textoCSV(valor) {
    const texto = String(valor ?? "")
        .replace(/^[=+\-@\t\r]/, "'");

    return '"' +
        texto.replace(/"/g, '""') +
        '"';
}

$("exportarBtn").addEventListener("click", () => {

    if (!datosListos) {
        alert("Espera a que terminen de cargar los registros.");
        return;
    }

    if (reservas.length === 0) {
        alert("No existen registros para exportar.");
        return;
    }

    const columnas = [
        "Fecha",
        "Hora inicio",
        "Hora fin",
        "Alumno",
        "Celular",
        "Servicio",
        "Instructor",
        "Estado",
        "Observacion"
    ];

    const filas = reservas.map(r => [
        r.fecha,
        r.hora,
        horaFinal(r.hora, r.duracion),
        r.alumno,
        r.celular || "",
        r.servicio,
        r.instructor,
        r.estado,
        r.observacion || ""
    ]);

    const contenido = [columnas, ...filas]
        .map(fila =>
            fila.map(textoCSV).join(";")
        )
        .join("\r\n");

    const archivo = new Blob(
        ["\uFEFF" + contenido],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(archivo);

    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "Agenda_PARTNERS.csv";

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
});

// =============================================
// ALARMA CON SONIDO 5 MINUTOS ANTES
// =============================================

const alertasMostradas = new Set();

let audioPartners = null;

function activarSonido() {

    const Contexto =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!Contexto) return;

    if (!audioPartners) {
        audioPartners = new Contexto();
    }

    if (audioPartners.state === "suspended") {
        audioPartners.resume().catch(console.error);
    }
}

// Activar sonido al interactuar con la agenda
document.addEventListener("click", activarSonido);
document.addEventListener("keydown", activarSonido);

function sonarAlarma() {

    if (
        !audioPartners ||
        audioPartners.state !== "running"
    ) return;

    const inicio = audioPartners.currentTime;

    for (let i = 0; i < 3; i++) {

        const oscilador =
            audioPartners.createOscillator();

        const volumen =
            audioPartners.createGain();

        const tiempo = inicio + i * 0.35;

        oscilador.type = "sine";
        oscilador.frequency.value = 880;

        volumen.gain.setValueAtTime(
            0.0001, tiempo
        );

        volumen.gain.exponentialRampToValueAtTime(
            0.25, tiempo + 0.02
        );

        volumen.gain.exponentialRampToValueAtTime(
            0.0001, tiempo + 0.25
        );

        oscilador.connect(volumen);
        volumen.connect(audioPartners.destination);

        oscilador.start(tiempo);
        oscilador.stop(tiempo + 0.26);
    }
}

function mostrarAlerta(reserva) {

    const ventana =
        document.createElement("div");

    ventana.className = "alarma-partners";

    const contenido =
        document.createElement("div");

    contenido.className = "alarma-contenido";

    const icono = document.createElement("div");
    icono.className = "alarma-icono";
    icono.textContent = "🔔";

    const titulo = document.createElement("h2");
    titulo.textContent =
        "¡PRÓXIMA CLASE PARTNERS!";

    const descripcion =
        document.createElement("p");

    descripcion.textContent =
        "Faltan 5 minutos o menos para la clase.";

    const alumno = document.createElement("p");
    alumno.textContent =
        "Alumno: " + reserva.alumno;

    const hora = document.createElement("p");
    hora.textContent =
        "Hora: " + reserva.hora;

    const instructor =
        document.createElement("p");

    instructor.textContent =
        "Instructor: " + reserva.instructor;

    const cerrar =
        document.createElement("button");

    cerrar.type = "button";
    cerrar.textContent = "ENTENDIDO";

    cerrar.addEventListener("click", () => {
        ventana.remove();
    });

    contenido.append(
        icono,
        titulo,
        descripcion,
        alumno,
        hora,
        instructor,
        cerrar
    );

    ventana.appendChild(contenido);

    document.body.appendChild(ventana);

    sonarAlarma();
}

function revisarAlarmas() {

    if (!usuarioActual || !datosListos) return;

    const ahora = Date.now();

    reservas.forEach(reserva => {

        if (reserva.estado !== "programada") {
            return;
        }

        const fechaHora = new Date(
            reserva.fecha + "T" +
            reserva.hora + ":00"
        ).getTime();

        if (!Number.isFinite(fechaHora)) return;

        const diferencia = fechaHora - ahora;

        if (
            diferencia <= 0 ||
            diferencia > 5 * 60 * 1000
        ) {
            return;
        }

        if (alertasMostradas.has(reserva.id)) {
            return;
        }

        alertasMostradas.add(reserva.id);

        mostrarAlerta(reserva);
    });
}

// Comprobar cada 10 segundos
setInterval(revisarAlarmas, 10000);

// Revisar al volver a la pestaña
document.addEventListener(
    "visibilitychange",
    () => {
        if (!document.hidden) {
            revisarAlarmas();
        }
    }
);

// =============================================
// ACTUALIZAR TODA LA AGENDA
// =============================================

function actualizarPantalla() {
    dibujarCalendario();
    actualizarEstadisticas();
    dibujarTabla();
    revisarAlarmas();
}

// INICIAR EL CALENDARIO
$("fecha").value = fechaActual;

actualizarPantalla();

console.log(
    "AGENDA PARTNERS: JavaScript cargado correctamente."
);
